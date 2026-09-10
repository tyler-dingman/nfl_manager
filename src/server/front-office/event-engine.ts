import type { FranchiseSimulationState } from '@/types/front-office';
import type { NewFrontOfficeEvent } from './events-repository';
import { selectReSignReadyCandidate, type ReSignReadyCandidate } from './re-sign-ready';

export const FRONT_OFFICE_EVENT_CONFIG = {
  maxEventsPerAdvancedWeek: 3,
  maxToastEventsPerAdvance: 1,
  tradeInterestChance: 0.2,
  deadlineWeek: 8,
} as const;

const hash = (value: string) => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
};

function makeEvent(
  state: FranchiseSimulationState,
  saveId: string,
  week: number,
  input: Omit<
    NewFrontOfficeEvent,
    'id' | 'saveId' | 'simulationSeason' | 'simulationWeek' | 'simulationPhase' | 'expiresAt'
  >,
): NewFrontOfficeEvent {
  return {
    ...input,
    id: `foe_${hash(`${state.seed}:${week}:${input.dedupeKey}`).toString(36)}`,
    saveId,
    simulationSeason: state.season,
    simulationWeek: week,
    simulationPhase: state.phase,
    expiresAt: null,
  };
}

export function generateFrontOfficeEvents(input: {
  saveId: string;
  teamAbbr: string;
  previous: FranchiseSimulationState;
  current: FranchiseSimulationState;
  reSignCandidates?: ReSignReadyCandidate[];
}) {
  const { current, previous, reSignCandidates = [], saveId, teamAbbr } = input;
  const generated: NewFrontOfficeEvent[] = [];
  const start = Math.max(1, previous.currentWeek + 1);
  const end = Math.max(start, current.currentWeek);

  for (let week = start; week <= end; week += 1) {
    const weekly: NewFrontOfficeEvent[] = [];
    if (week === FRONT_OFFICE_EVENT_CONFIG.deadlineWeek) {
      weekly.push(
        makeEvent(current, saveId, week, {
          dedupeKey: 'trade-deadline',
          type: 'deadline_alert',
          priority: 'urgent',
          headline: 'The trade deadline is here',
          summary: 'Pending offers expire after this week. Make your final roster moves now.',
          teamAbbr,
          relatedTeamAbbr: null,
          playerId: null,
          prospectId: null,
          tradeOfferId: null,
          actionUrl: '/manage/trades',
          metadata: { deadlineWeek: week },
        }),
      );
    }

    if (
      week >= 3 &&
      week <= FRONT_OFFICE_EVENT_CONFIG.deadlineWeek &&
      hash(`${current.seed}:interest:${week}`) / 0xffffffff <
        FRONT_OFFICE_EVENT_CONFIG.tradeInterestChance
    ) {
      const partner = Object.keys(current.teams)
        .filter((abbr) => abbr !== teamAbbr)
        .sort()[hash(`${current.seed}:partner:${week}`) % 31];
      weekly.push(
        makeEvent(current, saveId, week, {
          dedupeKey: `trade-interest:${partner}`,
          type: 'trade_interest',
          priority: 'high',
          headline: `${partner} has called your front office`,
          summary:
            'A rival general manager is exploring a deal. Open the Trade Hub to review your market.',
          teamAbbr,
          relatedTeamAbbr: partner,
          playerId: null,
          prospectId: null,
          tradeOfferId: null,
          actionUrl: '/manage/trades',
          metadata: { partnerTeamAbbr: partner },
        }),
      );
    }

    const readyPlayer = selectReSignReadyCandidate({
      seed: current.seed,
      week,
      candidates: reSignCandidates.filter(
        (candidate) => !current.contractNegotiations?.[candidate.playerId],
      ),
      simulation: current,
    });
    if (readyPlayer) {
      current.contractNegotiations = {
        ...current.contractNegotiations,
        [readyPlayer.playerId]: {
          contractId: readyPlayer.contractId,
          state: 'ready',
          readyWeek: week,
          updatedAt: new Date(0).toISOString(),
        },
      };
      weekly.push(
        makeEvent(current, saveId, week, {
          dedupeKey: `re-sign-ready:${readyPlayer.playerId}:${current.season}`,
          type: 're_sign_ready',
          priority: 'high',
          headline: `${readyPlayer.name} is ready to start negotiations`,
          summary: `His contract expires at the end of the ${current.season} season.`,
          teamAbbr,
          relatedTeamAbbr: null,
          playerId: readyPlayer.playerId,
          prospectId: null,
          tradeOfferId: null,
          actionUrl: `/roster?view=resign&playerId=${encodeURIComponent(readyPlayer.playerId)}&openNegotiation=1`,
          metadata: {
            contractId: readyPlayer.contractId,
            position: readyPlayer.position,
            rating: readyPlayer.rating,
            contractYear: current.season,
            headshotUrl: readyPlayer.headshotUrl,
            negotiationState: 'ready',
          },
        }),
      );
    }
    generated.push(...weekly.slice(0, FRONT_OFFICE_EVENT_CONFIG.maxEventsPerAdvancedWeek));
  }

  const priorTransactions = new Set(previous.transactions.map((transaction) => transaction.id));
  for (const transaction of current.transactions
    .filter((entry) => !priorTransactions.has(entry.id))
    .slice(-8)) {
    const type =
      transaction.type === 'signing'
        ? 'free_agent_signing'
        : transaction.type === 'cut'
          ? 'player_release'
          : transaction.type === 're-sign'
            ? 'contract_extension'
            : 'league_transaction';
    generated.push(
      makeEvent(current, saveId, current.currentWeek, {
        dedupeKey: `transaction:${transaction.id}`,
        type,
        priority: transaction.teamAbbr === teamAbbr ? 'high' : 'normal',
        headline: transaction.playerName
          ? `${transaction.teamAbbr} makes a move with ${transaction.playerName}`
          : `${transaction.teamAbbr} updates its roster`,
        summary: transaction.summary,
        teamAbbr: transaction.teamAbbr,
        relatedTeamAbbr: null,
        playerId: transaction.playerId ?? null,
        prospectId: null,
        tradeOfferId: null,
        actionUrl: transaction.teamAbbr === teamAbbr ? '/roster' : '/experience',
        metadata: { transactionId: transaction.id, transactionType: transaction.type },
      }),
    );
  }

  if (current.phase.includes('draft')) {
    generated.push(
      makeEvent(current, saveId, current.currentWeek, {
        dedupeKey: `draft-buzz:${current.phase}`,
        type: 'draft_buzz',
        priority: 'high',
        headline: 'Draft boards are moving',
        summary:
          'League scouts are reshuffling the top tier. Review your board before you are on the clock.',
        teamAbbr,
        relatedTeamAbbr: null,
        playerId: null,
        prospectId: null,
        tradeOfferId: null,
        actionUrl: '/draft/big-board',
        metadata: { draftOrder: current.draftOrder.slice(0, 10) },
      }),
    );
  }

  if (current.playoffs?.champion) {
    generated.push(
      makeEvent(current, saveId, current.currentWeek, {
        dedupeKey: `champion:${current.playoffs.champion}`,
        type: 'playoff_update',
        priority: 'high',
        headline: `${current.playoffs.champion} wins the championship`,
        summary: 'The season is complete. The offseason and a new roster-building cycle are next.',
        teamAbbr: current.playoffs.champion,
        relatedTeamAbbr: null,
        playerId: null,
        prospectId: null,
        tradeOfferId: null,
        actionUrl: '/experience',
        metadata: {},
      }),
    );
  }
  return generated;
}
