import { restoreDraftSession } from '@/server/api/draft';
import { createHash } from 'node:crypto';
import { buildOffseasonHeroContext, heroPerson as person } from './hero-offseason-context';
import { offseasonHeroPhases } from '../../../packages/front-office/hero-offseason';
import { heroStoryKey } from '../../../packages/front-office/hero-story';
import { buildStandingsSnapshot, rankStandings } from '@/lib/front-office-standings';
import { authDb } from '@/server/auth/database';
import type { TradeOfferDTO } from '@/types/trade-offers';
import { ensureSaveState, hydrateOffseasonFreeAgencyState } from '@/server/api/store';
import { getActiveSimulationRoster } from '@/lib/front-office-roster';
import { analyzeTeamNeeds } from '@/lib/team-overview';
import { gameDayHeroAsset } from '@/config/game-day-hero';
import { getDraftProspectsForYear } from '@/server/data/draft-prospects';
import { buildDraftCentralIntelligence } from './draft/draft-intelligence';
import { buildTradeTargets } from './trades/trade-target-engine';
import { FRONT_OFFICE_EVENT_CONFIG } from './event-engine';
import {
  heroWeek,
  heroImageIdentity,
  previousWeeklyHero,
  selectHeroStory,
  type HeroContext,
  type HeroPerson,
} from '../../../packages/front-office/hero-story';
import type { FranchiseSimulationState } from '@/types/front-office';
import type { PlayerRowDTO } from '@/types/player';

export async function ensureWeeklyHero(
  saveId: string,
  team: string,
  state: FranchiseSimulationState,
  userId: string,
) {
  const week = heroWeek(state);
  const offseason = offseasonHeroPhases.includes(state.phase);
  if (!offseason && (week < 1 || week > 18)) return state;
  const key = heroStoryKey(state);
  const saved = state.heroStories?.[key];
  const store = ensureSaveState(saveId, team, state.season);
  if (offseason) await hydrateOffseasonFreeAgencyState(store);
  if (offseason && state.activeDraft && !store.draftSessions[state.activeDraft.id])
    restoreDraftSession(saveId, state.activeDraft);
  const roster = getActiveSimulationRoster(store.roster, team);
  const previous = previousWeeklyHero(state);
  const repeatsPreviousImage =
    saved && previous && heroImageIdentity(saved.image) === heroImageIdentity(previous.image);
  // Frozen copy is preserved; only missing/moved subjects invalidate a selection.
  if (
    !offseason &&
    saved &&
    !repeatsPreviousImage &&
    (!saved.subjectId ||
      saved.visualType === 'coach' ||
      (saved.visualType === 'prospect' &&
        getDraftProspectsForYear(state.season + 1).some(
          (p) => p.id === saved.subjectId && p.headshotUrl,
        )) ||
      (saved.visualType === 'player'
        ? roster
        : saved.visualType === 'free-agent'
          ? store.freeAgents.filter((p) => !p.isSignedByCpu && !p.isSignedByUser)
          : Object.values(store.teamRosters).flat()
      ).some((p) => p.id === saved.subjectId && p.headshotUrl))
  )
    return state;
  const targets = buildTradeTargets(store, state, team)
    .filter((p) => p.tradeAvailabilityScore >= 41 && (p.rating ?? 0) >= 72)
    .slice(0, 24);
  const draft =
    week >= 10 || offseason
      ? buildDraftCentralIntelligence({
          state: store,
          simulation: state,
          prospects: getDraftProspectsForYear(state.season + 1),
          teamAbbr: team,
        })
      : null;
  const freeAgents = store.freeAgents.filter(
    (p) =>
      !p.isSignedByCpu &&
      !p.isSignedByUser &&
      !['signed', 'removed'].includes(p.freeAgentProfile?.availabilityStatus ?? '') &&
      !['signed', 'removed'].includes(p.availabilityStatus ?? '') &&
      !['signed', 'removed'].includes(p.marketStatus ?? '') &&
      !['signed', 'active'].includes(p.status.toLowerCase()),
  );
  const offers = await authDb()<
    Array<{ offer: TradeOfferDTO }>
  >`SELECT offer_data AS offer FROM front_office_trade_offers WHERE user_id=${userId} AND save_id=${saveId} AND status='pending' AND expires_week >= ${week}`;
  const offerCounts = new Map<string, number>();
  offers.forEach(({ offer }) =>
    [offer.incoming, offer.outgoing]
      .filter((side) => side.teamAbbr === team)
      .flatMap((side) => side.assets)
      .forEach((asset) => {
        if (asset.type === 'player')
          offerCounts.set(asset.playerId, (offerCounts.get(asset.playerId) ?? 0) + 1);
      }),
  );
  const context: HeroContext = {
    state,
    ...(offseason ? { offseason: buildOffseasonHeroContext(store, state, team) } : {}),
    team,
    stadium: gameDayHeroAsset(team) ?? '/assets/front-office/news-graphics/backgrounds/stadium.svg',
    players: [
      ...roster,
      ...store.roster.filter((p) => p.rosterAssignment === 'injured_reserve'),
    ].map(person),
    injuries: store.roster
      .filter((p) => p.rosterAssignment === 'injured_reserve')
      .map((p) => ({ playerId: p.id, detail: 'On injured reserve' })),
    freeAgents: freeAgents.map(person),
    targets: targets.map(person),
    needs: analyzeTeamNeeds(roster)
      .filter((n) => n.level !== 'Low')
      .map((n) => n.position),
    deadlineWeek: FRONT_OFFICE_EVENT_CONFIG.deadlineWeek,
    offers: [...offerCounts].map(([playerId, count]) => ({ playerId, count })),
    ownership: state.heroOwnership,
    projectedPick:
      week >= 10
        ? rankStandings(Object.values(buildStandingsSnapshot(state, state.currentWeek)))
            .reverse()
            .findIndex((t) => t.abbr === team) + 1 || undefined
        : undefined,
    priorProjectedPick: Object.values(state.heroStories ?? {})
      .filter((s) => s.season === state.season && s.week < week && s.projectedPick != null)
      .sort((a, b) => b.week - a.week)[0]?.projectedPick,
    prospects: (offseason ? (draft?.prospects ?? []) : (draft?.fits ?? [])).map((p) => ({
      id: p.id,
      name: p.name,
      position: p.position ?? undefined,
      image: p.headshotUrl,
      rank: p.currentRank,
      priorRank: p.priorRank,
      school: p.school ?? undefined,
      low: p.projectedPickLow,
      high: p.projectedPickHigh,
    })),
  };
  const signature = offseason
    ? createHash('sha256')
        .update(
          JSON.stringify({
            phase: state.phase,
            offseason: context.offseason,
            players: context.players,
            freeAgents: context.freeAgents,
            needs: context.needs,
            prospects: context.prospects,
            ownership: context.ownership,
            acknowledgements: state.heroAcknowledgements,
          }),
        )
        .digest('hex')
    : undefined;
  if (offseason && saved?.contextSignature === signature) return state;
  const story = selectHeroStory(context);
  if (!story) return state;
  if (story.category === 'development')
    state.heroDevelopmentSeasons = [
      ...new Set([...(state.heroDevelopmentSeasons ?? []), state.season]),
    ];
  const subject = [...roster, ...freeAgents, ...targets].find((p) => p.id === story.playerId);
  if (offseason && saved) state.heroHistory = [...(state.heroHistory ?? []), saved].slice(-80);
  state.heroStories = {
    ...state.heroStories,
    [key]: {
      ...story,
      contextSignature: signature,
      ...(subject ? { subjectPlayer: subject } : {}),
    },
  };
  return state;
}
