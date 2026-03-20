import { TEAM_LIST } from '@/data/teams';
import { createRng } from '@/lib/deterministic-rng';
import { getTeamReactionLine } from '@/lib/team-flavor';
import { buildPickAsset } from '@/lib/trade-chart';
import { gradeTradeOffer } from '@/lib/trade-offer-evaluator';
import { buildTradePlayerAsset, getPlayerTradeValue } from '@/lib/trade-player-valuation';
import { getTeamTradeProfile } from '@/lib/trade-team-profile';
import { computeTeamNeeds, resolvePlayerRating } from '@/lib/team-overview';
import { logoUrlFor } from '@/server/api/team';
import {
  getOrBuildProjectedRosterForTeam,
  getProjectedCapSpaceForTeam,
  type SaveState,
} from '@/server/api/store';
import type { PlayerRowDTO } from '@/types/player';
import type { TeamDTO } from '@/types/team';
import type {
  DraftPickTradeInput,
  TradeAssetPackage,
  TradeEvaluationContext,
  TradeOfferArchetype,
  TradeOfferCandidate,
  TradeOfferDTO,
  TradeOfferGenerationContext,
  TradeOfferGenerationResult,
  TradeOfferPhase,
} from '@/types/trade-offers';

type TeamRuntimeContext = {
  team: TeamDTO;
  roster: PlayerRowDTO[];
  needs: string[];
  capSpace: number;
  profile: ReturnType<typeof getTeamTradeProfile>;
};

const MAX_OFFERS_BY_PHASE: Record<TradeOfferPhase, number> = {
  manage: 2,
  freeAgency: 2,
  draft: 4,
};

const TRADE_OFFER_USER_BUY_IN_MULTIPLIER = 1.12;
const TRADE_OFFER_USER_SELL_DISCOUNT = 0.9;

const normalizedPosition = (player: Pick<PlayerRowDTO, 'position'>) => {
  const position = player.position.toUpperCase();
  if (['LT', 'RT'].includes(position)) return 'OT';
  if (['LG', 'RG', 'C'].includes(position)) return 'IOL';
  if (['LE', 'RE', 'DE', 'EDGE', 'ED'].includes(position)) return 'EDGE';
  if (['DT', 'NT', 'DL', 'IDL'].includes(position)) return 'DL';
  if (['FS', 'SS'].includes(position)) return 'S';
  return position;
};

const activePlayers = (roster: PlayerRowDTO[]) =>
  roster.filter(
    (player) =>
      player.status?.toLowerCase() !== 'cut' &&
      typeof resolvePlayerRating(player) === 'number',
  );

const averageRating = (players: PlayerRowDTO[]) => {
  const ratings = players.map((player) => resolvePlayerRating(player)).filter((value): value is number => value !== null);
  if (ratings.length === 0) return 70;
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
};

const isTradableUserTarget = (player: PlayerRowDTO) => {
  const rating = resolvePlayerRating(player) ?? 0;
  const age = player.age ?? 27;
  const yearsRemaining = Math.max(1, player.contract?.yearsRemaining ?? player.contractYearsRemaining ?? 1);
  if (player.position === 'QB' && rating >= 86 && yearsRemaining >= 2) return false;
  if (rating >= 90 && yearsRemaining >= 2 && age <= 29) return false;
  return rating >= 72;
};

export const buildTeamContexts = (state: SaveState): Map<string, TeamRuntimeContext> => {
  const generatedTeams = new Map<string, TeamDTO>(
    TEAM_LIST.map((team) => [
      team.abbr,
      {
        id: team.id,
        abbr: team.abbr,
        name: team.name,
        logoUrl: team.logoUrl,
        colors: team.colors,
        teamOverview: 75,
        offenseOverview: 75,
        defenseOverview: 75,
        specialTeamsOverview: 75,
        teamOverviewGrade: 'B-',
        teamNeeds: ['QB', 'OT', 'CB'],
      },
    ]),
  );

  const contexts = new Map<string, TeamRuntimeContext>();
  generatedTeams.forEach((team, abbr) => {
    const roster = activePlayers(getOrBuildProjectedRosterForTeam(state, abbr));
    const capSpace = getProjectedCapSpaceForTeam(state, abbr);
    const needs = computeTeamNeeds(roster, 5);
    contexts.set(abbr, {
      team,
      roster,
      needs,
      capSpace,
      profile: getTeamTradeProfile(team, roster, capSpace, `${state.header.id}:${abbr}`),
    });
  });
  return contexts;
};

export const buildEvaluationContext = (
  phase: TradeOfferPhase,
  teamAbbr: string,
  teamContext: TeamRuntimeContext,
): TradeEvaluationContext => ({
  teamAbbr,
  phase,
  contenderWindow:
    teamContext.profile.winNow >= 0.65
      ? 'win_now'
      : teamContext.profile.rebuilding >= 0.65
        ? 'rebuild'
        : 'balanced',
  needs: teamContext.needs,
  capSpace: teamContext.capSpace,
});

const makePackage = (assets: TradeAssetPackage['assets']): TradeAssetPackage => ({
  assets,
  totalValue: Number(assets.reduce((sum, asset) => sum + asset.projectedValuePoints, 0).toFixed(1)),
});

const draftPickForValue = (
  teamAbbr: string,
  targetValue: number,
  year = 2026,
): DraftPickTradeInput[] => {
  if (targetValue >= 950) {
    return [{ year, round: 1, overallSlot: 22, owningTeamAbbr: teamAbbr }];
  }
  if (targetValue >= 450) {
    return [{ year, round: 2, overallSlot: 48, owningTeamAbbr: teamAbbr }];
  }
  if (targetValue >= 240) {
    return [{ year, round: 3, overallSlot: 82, owningTeamAbbr: teamAbbr }];
  }
  if (targetValue >= 120) {
    return [{ year, round: 4, overallSlot: 114, owningTeamAbbr: teamAbbr }];
  }
  if (targetValue >= 70) {
    return [{ year, round: 5, overallSlot: 150, owningTeamAbbr: teamAbbr }];
  }
  if (targetValue >= 35) {
    return [{ year, round: 6, overallSlot: 188, owningTeamAbbr: teamAbbr }];
  }
  return [{ year, round: 7, overallSlot: 220, owningTeamAbbr: teamAbbr }];
};

const offerId = (seed: string, archetype: TradeOfferArchetype, teamAbbr: string) =>
  `offer-${teamAbbr.toLowerCase()}-${archetype}-${seed.replace(/[^a-z0-9]+/gi, '').toLowerCase()}`;

const buildOfferCandidate = (
  phase: TradeOfferPhase,
  trigger: string,
  userTeam: TeamRuntimeContext,
  aiTeam: TeamRuntimeContext,
  archetype: TradeOfferArchetype,
  incomingAssets: TradeAssetPackage['assets'],
  outgoingAssets: TradeAssetPackage['assets'],
  summary: string,
  reason: string,
  headline: string,
  seed: string,
  reasons: string[],
): TradeOfferCandidate | null => {
  if (incomingAssets.length === 0 || outgoingAssets.length === 0) {
    return null;
  }

  const incoming = makePackage(incomingAssets);
  const outgoing = makePackage(outgoingAssets);
  const userContext = buildEvaluationContext(phase, userTeam.team.abbr, userTeam);
  const aiContext = buildEvaluationContext(phase, aiTeam.team.abbr, aiTeam);
  const graded = gradeTradeOffer(
    incoming,
    outgoing,
    userContext,
    userTeam.profile,
    outgoing,
    incoming,
    aiContext,
    aiTeam.profile,
  );

  if (graded.ai.score < 0.9) {
    return null;
  }

  const id = offerId(seed, archetype, aiTeam.team.abbr);
  const offer: TradeOfferDTO = {
    id,
    phase,
    archetype,
    trigger,
    generatedAt: new Date().toISOString(),
    chartModel: 'drafttek-classic',
    proposingTeamAbbr: aiTeam.team.abbr,
    proposingTeamName: aiTeam.team.name,
    proposingTeamLogoUrl: aiTeam.team.logoUrl || logoUrlFor(aiTeam.team.abbr),
    headline,
    summary,
    reason: `${reason} ${getTeamReactionLine(
      aiTeam.team.abbr,
      phase === 'draft' ? 'confident' : 'neutral',
      { seed: `${seed}:reason` },
    )}`.trim(),
    urgency:
      phase === 'draft'
        ? `Pick ${trigger.replace('pick-', '')} is live — ${aiTeam.team.name} wants a quick answer.`
        : undefined,
    incoming: {
      teamAbbr: aiTeam.team.abbr,
      teamName: aiTeam.team.name,
      totalValue: incoming.totalValue,
      assets: incoming.assets,
    },
    outgoing: {
      teamAbbr: userTeam.team.abbr,
      teamName: userTeam.team.name,
      totalValue: outgoing.totalValue,
      assets: outgoing.assets,
    },
    userInterest: {
      label: graded.user.label,
      band: graded.user.band,
      score: graded.user.score,
    },
    aiInterest: {
      label: graded.ai.label,
      band: graded.ai.band,
      score: graded.ai.score,
    },
    debug: {
      seed,
      candidateScore: Number(((graded.user.score + graded.ai.score) * 50).toFixed(1)),
      userScore: graded.user.score,
      aiScore: graded.ai.score,
      reasons,
    },
  };

  return {
    offer,
    candidateScore: offer.debug.candidateScore,
    reasons,
  };
};

const generateRosterOffers = (
  phase: TradeOfferPhase,
  trigger: string,
  state: SaveState,
  userTeam: TeamRuntimeContext,
  contexts: Map<string, TeamRuntimeContext>,
  shownOfferIds: Set<string>,
): TradeOfferCandidate[] => {
  const candidates: TradeOfferCandidate[] = [];
  const userNeedSet = new Set(userTeam.needs);
  const userRoster = userTeam.roster;
  const tradableTargets = userRoster
    .filter(isTradableUserTarget)
    .sort((a, b) => (resolvePlayerRating(b) ?? 0) - (resolvePlayerRating(a) ?? 0));

  contexts.forEach((aiTeam, abbr) => {
    if (abbr === userTeam.team.abbr) return;
    const aiRoster = aiTeam.roster
      .slice()
      .sort((a, b) => (resolvePlayerRating(b) ?? 0) - (resolvePlayerRating(a) ?? 0));

    const offeredPlayer = aiRoster.find((player) => {
      const rating = resolvePlayerRating(player) ?? 0;
      const pos = normalizedPosition(player);
      const yearsRemaining = Math.max(1, player.contract?.yearsRemaining ?? player.contractYearsRemaining ?? 1);
      return (
        rating >= 75 &&
        (userNeedSet.has(pos) || userNeedSet.has(player.position)) &&
        ((player.age ?? 27) >= 28 || yearsRemaining === 1 || aiTeam.capSpace < 8)
      );
    });

    if (offeredPlayer) {
      const offeredValue = getPlayerTradeValue(offeredPlayer, buildEvaluationContext(phase, userTeam.team.abbr, userTeam)).value;
      const outgoingPickAssets = draftPickForValue(
        userTeam.team.abbr,
        offeredValue * TRADE_OFFER_USER_BUY_IN_MULTIPLIER,
      ).map((pick) =>
        buildPickAsset(pick),
      );
      const candidate = buildOfferCandidate(
        phase,
        trigger,
        userTeam,
        aiTeam,
        (offeredPlayer.age ?? 27) >= 29
          ? 'veteran_expiring'
          : aiTeam.capSpace < 8
            ? 'cap_casualty'
            : 'buried_depth',
        [buildTradePlayerAsset(offeredPlayer, buildEvaluationContext(phase, userTeam.team.abbr, userTeam))],
        outgoingPickAssets,
        `${aiTeam.team.name} will send ${offeredPlayer.firstName} ${offeredPlayer.lastName} for draft capital.`,
        userNeedSet.has(normalizedPosition(offeredPlayer))
          ? `They noticed your need at ${normalizedPosition(offeredPlayer)} and think there’s a fit.`
          : 'They are open to moving a veteran to rebalance their roster.',
        phase === 'freeAgency'
          ? `${aiTeam.team.name} noticed you shopping ${normalizedPosition(offeredPlayer)}`
          : `${aiTeam.team.name} is floating a veteran deal`,
        `${state.header.id}:${phase}:${trigger}:${abbr}:incoming:${offeredPlayer.id}`,
        [
          `offered-player:${offeredPlayer.id}`,
          `user-needs:${userTeam.needs.join(',')}`,
          `ai-cap-space:${aiTeam.capSpace.toFixed(1)}`,
        ],
      );
      if (candidate && !shownOfferIds.has(candidate.offer.id)) {
        candidates.push(candidate);
      }
    }

    const userTarget = tradableTargets.find((player) => {
      const pos = normalizedPosition(player);
      const rating = resolvePlayerRating(player) ?? 0;
      return aiTeam.needs.includes(pos) && rating >= 76;
    });

    if (userTarget) {
      const targetValue = getPlayerTradeValue(userTarget, buildEvaluationContext(phase, aiTeam.team.abbr, aiTeam)).value;
      const aiPickAssets = draftPickForValue(
        aiTeam.team.abbr,
        targetValue * TRADE_OFFER_USER_SELL_DISCOUNT,
      ).map((pick) =>
        buildPickAsset(pick),
      );
      const candidate = buildOfferCandidate(
        phase,
        trigger,
        userTeam,
        aiTeam,
        (userTarget.age ?? 27) <= 25 ? 'young_expiring' : 'needs_based_swap',
        aiPickAssets,
        [buildTradePlayerAsset(userTarget, buildEvaluationContext(phase, aiTeam.team.abbr, aiTeam))],
        `${aiTeam.team.name} wants ${userTarget.firstName} ${userTarget.lastName} and will pay with picks.`,
        `They have a real need at ${normalizedPosition(userTarget)} and view ${userTarget.lastName} as a fit.`,
        `${aiTeam.team.name} are calling about ${userTarget.lastName}`,
        `${state.header.id}:${phase}:${trigger}:${abbr}:outgoing:${userTarget.id}`,
        [
          `target-player:${userTarget.id}`,
          `target-position:${normalizedPosition(userTarget)}`,
          `ai-needs:${aiTeam.needs.join(',')}`,
        ],
      );
      if (candidate && !shownOfferIds.has(candidate.offer.id)) {
        candidates.push(candidate);
      }
    }
  });

  return candidates;
};

const buildDraftPickMovePackage = (teamAbbr: string, pickNumber: number, wantsToMoveUp: boolean) => {
  if (wantsToMoveUp) {
    return [
      buildPickAsset({ year: 2026, round: 1, overallSlot: pickNumber + 5, owningTeamAbbr: teamAbbr }),
      buildPickAsset({ year: 2027, round: 3, projectedRound: 3, owningTeamAbbr: teamAbbr }),
    ];
  }
  return [
    buildPickAsset({ year: 2026, round: 1, overallSlot: Math.max(1, pickNumber - 4), owningTeamAbbr: teamAbbr }),
  ];
};

const generateDraftOffers = (
  trigger: string,
  state: SaveState,
  userTeam: TeamRuntimeContext,
  contexts: Map<string, TeamRuntimeContext>,
  shownOfferIds: Set<string>,
  pickIndex: number,
): TradeOfferCandidate[] => {
  const candidates: TradeOfferCandidate[] = [];
  const userPickOverall = Math.max(1, pickIndex + 1);
  const nearbyTeams = TEAM_LIST.filter((team) => team.abbr !== userTeam.team.abbr).slice(0, 10);

  nearbyTeams.forEach((team, index) => {
    const aiTeam = contexts.get(team.abbr);
    if (!aiTeam) return;

    const wantsToMoveUp = index % 2 === 0;
    const incomingAssets = buildDraftPickMovePackage(team.abbr, userPickOverall, wantsToMoveUp);
    const outgoingAssets = [
      buildPickAsset({
        year: 2026,
        round: 1,
        overallSlot: userPickOverall,
        owningTeamAbbr: userTeam.team.abbr,
      }),
    ];

    const candidate = buildOfferCandidate(
      'draft',
      trigger,
      userTeam,
      aiTeam,
      wantsToMoveUp ? 'move_down' : 'move_up',
      incomingAssets,
      outgoingAssets,
      wantsToMoveUp
        ? `${aiTeam.team.name} wants to jump up for Pick ${userPickOverall}.`
        : `${aiTeam.team.name} will move up and send back a nearby first.`,
      wantsToMoveUp
        ? 'They think a premium player is about to come off the board.'
        : 'They are shopping draft position and future flexibility.',
      `Pick ${userPickOverall} is on the clock — ${aiTeam.team.name} calling`,
      `${state.header.id}:draft:${trigger}:${team.abbr}:${index}`,
      [`draft-pick:${userPickOverall}`, `move-up:${String(wantsToMoveUp)}`],
    );

    if (candidate && !shownOfferIds.has(candidate.offer.id)) {
      candidates.push(candidate);
    }
  });

  const splashTeam = contexts
    .values()
    .find((context) =>
      context.team.abbr !== userTeam.team.abbr &&
      context.roster.some((player) => (resolvePlayerRating(player) ?? 0) >= 80),
    );
  if (splashTeam) {
    const splashPlayer = splashTeam.roster
      .filter((player) => (resolvePlayerRating(player) ?? 0) >= 80)
      .sort((a, b) => (resolvePlayerRating(b) ?? 0) - (resolvePlayerRating(a) ?? 0))[0];
    if (splashPlayer) {
      const candidate = buildOfferCandidate(
        'draft',
        trigger,
        userTeam,
        splashTeam,
        'splash_player_pick',
        [
          buildTradePlayerAsset(splashPlayer, buildEvaluationContext('draft', userTeam.team.abbr, userTeam)),
          buildPickAsset({ year: 2026, round: 2, overallSlot: 50, owningTeamAbbr: splashTeam.team.abbr }),
        ],
        [
          buildPickAsset({
            year: 2026,
            round: 1,
            overallSlot: userPickOverall,
            owningTeamAbbr: userTeam.team.abbr,
          }),
        ],
        `${splashTeam.team.name} will include ${splashPlayer.firstName} ${splashPlayer.lastName} plus a pick.`,
        'This is a rarer splash move built around an established starter.',
        `Big swing: ${splashTeam.team.name} attaches a player to move up`,
        `${state.header.id}:draft:${trigger}:splash:${splashTeam.team.abbr}:${splashPlayer.id}`,
        [`splash-player:${splashPlayer.id}`, `draft-pick:${userPickOverall}`],
      );
      if (candidate && !shownOfferIds.has(candidate.offer.id)) {
        candidates.push(candidate);
      }
    }
  }

  return candidates;
};

const logOfferDebug = (context: TradeOfferGenerationContext, message: string, payload: unknown) => {
  if (process.env.NODE_ENV === 'production') return;
  console.info(`[trade-offers] ${message}`, {
    phase: context.phase,
    trigger: context.trigger,
    ...((payload as Record<string, unknown>) ?? {}),
  });
};

export const generateTradeOffers = (
  state: SaveState,
  context: TradeOfferGenerationContext,
): TradeOfferGenerationResult => {
  const contexts = buildTeamContexts(state);
  const userTeam = contexts.get(context.userTeamAbbr);
  if (!userTeam) {
    return { offers: [], debug: [] };
  }

  const shownOfferIds = new Set(context.shownOfferIds ?? []);
  const mutedTeamAbbrs = new Set((context.mutedTeamAbbrs ?? []).map((abbr) => abbr.toUpperCase()));
  const candidates =
    context.phase === 'draft'
      ? generateDraftOffers(
          context.trigger,
          state,
          userTeam,
          contexts,
          shownOfferIds,
          context.draftCurrentPickIndex ?? 17,
        )
      : generateRosterOffers(context.phase, context.trigger, state, userTeam, contexts, shownOfferIds);

  const rng = createRng(`${state.header.id}:${context.phase}:${context.trigger}:offers`);
  const ranked = candidates
    .filter((candidate) => !mutedTeamAbbrs.has(candidate.offer.proposingTeamAbbr.toUpperCase()))
    .map((candidate) => ({
      ...candidate,
      blendedScore: candidate.candidateScore + rng() * 3,
    }))
    .sort((a, b) => b.blendedScore - a.blendedScore)
    .slice(0, MAX_OFFERS_BY_PHASE[context.phase]);

  logOfferDebug(context, 'generated', {
    count: ranked.length,
    ids: ranked.map((candidate) => candidate.offer.id),
  });

  return {
    offers: ranked.map((candidate) => candidate.offer),
    debug: ranked.map((candidate) => ({
      offerId: candidate.offer.id,
      seed: candidate.offer.debug.seed,
      candidateScore: candidate.candidateScore,
      reasons: candidate.reasons,
    })),
  };
};
