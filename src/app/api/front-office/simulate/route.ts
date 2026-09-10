import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  advanceSimulation,
  createFranchiseSimulation,
  startFranchiseAtWeekOne,
} from '@/lib/franchise-simulation';
import { authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';
import { getSaveStateResult } from '@/server/api/store';
import {
  createFallbackRegularSeasonSchedule,
  getNFLRegularSeasonSchedule,
} from '@/server/front-office/calendar';
import { generateFrontOfficeEvents } from '@/server/front-office/event-engine';
import { rankReSignReadyCandidates } from '@/server/front-office/re-sign-ready';
import {
  expireFrontOfficeTradeOffers,
  persistFrontOfficeEvents,
  persistFrontOfficeTradeOffer,
  resolveFrontOfficeEventsForPlayer,
} from '@/server/front-office/events-repository';
import { generateTradeOffers } from '@/server/logic/trade-offer-generator';
import {
  getFrontOfficeSaveMetadata,
  saveFranchiseSimulation,
} from '@/server/front-office/repository';

const bodySchema = z.object({
  saveId: z.string().min(1).max(160),
  action: z.enum(['initialize', 'advance', 'acknowledge']),
  target: z.string().min(1).max(40).optional(),
  recapKey: z.string().min(1).max(200).optional(),
  userTeamOverall: z.number().min(50).max(99).optional(),
});

const normalizeScheduleTeam = (abbr: string) =>
  abbr.toUpperCase() === 'WSH' ? 'WAS' : abbr.toUpperCase();

async function initializeSimulation(input: {
  userId: string;
  saveId: string;
  userTeamOverall?: number;
  initialPhase?: string;
}) {
  const metadata = await getFrontOfficeSaveMetadata(input.userId, input.saveId);
  if (!metadata) return null;
  if (metadata.simulation) return metadata;
  let schedule = await getNFLRegularSeasonSchedule(metadata.season).catch(() => []);
  if (schedule.length < 272) {
    schedule = createFallbackRegularSeasonSchedule(
      NFL_LEAGUE_DATA.teams.map((team) => team.abbr),
      metadata.season,
    );
  }
  let simulation = createFranchiseSimulation({
    seed: `${input.userId}:${input.saveId}:${metadata.season}`,
    season: metadata.season,
    teams: NFL_LEAGUE_DATA.teams.map((team) => ({
      abbr: team.abbr.toUpperCase(),
      conference: team.conference,
      division: team.division,
      overall:
        team.abbr.toUpperCase() === metadata.teamAbbr.toUpperCase() && input.userTeamOverall
          ? input.userTeamOverall
          : (team.teamOverview ?? 75),
    })),
    games: schedule.map((game) => ({
      id: game.id,
      week: game.week,
      homeTeam: normalizeScheduleTeam(game.homeTeam!),
      awayTeam: normalizeScheduleTeam(game.awayTeam!),
    })),
  });
  if (input.initialPhase === 'week-1') {
    simulation = startFranchiseAtWeekOne(simulation);
  } else if (input.initialPhase) {
    simulation.phase = input.initialPhase;
  }
  return saveFranchiseSimulation({
    userId: input.userId,
    saveId: input.saveId,
    expectedVersion: metadata.version ?? 1,
    simulation,
  });
}

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  const saveId = request.nextUrl.searchParams.get('saveId');
  if (!saveId) return NextResponse.json({ error: 'saveId is required.' }, { status: 400 });
  const state = await getFrontOfficeSaveMetadata(user.id, saveId);
  return NextResponse.json({ ok: true, state: state?.simulation ?? null, version: state?.version });
}

export async function POST(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  try {
    const input = bodySchema.parse(await request.json());
    let metadata = await initializeSimulation({
      userId: user.id,
      saveId: input.saveId,
      userTeamOverall: input.userTeamOverall,
      initialPhase: input.action === 'initialize' ? input.target : undefined,
    });
    if (!metadata) return NextResponse.json({ error: 'Save not found.' }, { status: 404 });
    if (input.action === 'initialize') {
      return NextResponse.json({ ok: true, state: metadata.simulation, version: metadata.version });
    }
    if (input.action === 'acknowledge') {
      if (!input.recapKey || !metadata.simulation) {
        return NextResponse.json({ error: 'recapKey is required.' }, { status: 400 });
      }
      const acknowledged = structuredClone(metadata.simulation);
      acknowledged.weekRecapAcknowledgements = {
        ...acknowledged.weekRecapAcknowledgements,
        [input.recapKey]: new Date().toISOString(),
      };
      const saved = await saveFranchiseSimulation({
        userId: user.id,
        saveId: input.saveId,
        expectedVersion: metadata.version ?? 1,
        simulation: acknowledged,
      });
      if (!saved) return NextResponse.json({ error: 'Refresh and try again.' }, { status: 409 });
      return NextResponse.json({ ok: true, state: saved.simulation, version: saved.version });
    }
    if (!input.target || !metadata.simulation) {
      return NextResponse.json({ error: 'target is required.' }, { status: 400 });
    }
    const previousSimulation = metadata.simulation;
    const saveState = getSaveStateResult(input.saveId);
    const userRoster = saveState.ok ? saveState.data.roster : [];
    const playerMap = new Map(
      NFL_LEAGUE_DATA.players.map((player) => [
        player.id,
        {
          id: player.id,
          name: player.name,
          position: player.position,
          teamAbbr: normalizeScheduleTeam(player.teamAbbr),
          rating: player.rating,
          headshotUrl: player.headshotUrl,
        },
      ]),
    );
    for (const player of userRoster) {
      playerMap.set(player.id, {
        id: player.id,
        name: `${player.firstName} ${player.lastName}`.trim(),
        position: player.position,
        teamAbbr: metadata.teamAbbr.toUpperCase(),
        rating: player.rating ?? player.maddenRating ?? player.baselineRating ?? 70,
        headshotUrl: player.headshotUrl ?? null,
      });
    }
    const simulation = advanceSimulation(previousSimulation, input.target, {
      players: [...playerMap.values()],
      recapTeamAbbr: metadata.teamAbbr.toUpperCase(),
    });
    if (simulation.currentWeek > previousSimulation.currentWeek + 1) {
      const latestGame = simulation.games.find(
        (game) =>
          game.week === simulation.currentWeek &&
          [game.homeTeam, game.awayTeam].includes(metadata.teamAbbr.toUpperCase()),
      );
      const key =
        latestGame?.id ?? `bye:${simulation.currentWeek}:${metadata.teamAbbr.toUpperCase()}`;
      simulation.weekRecapAcknowledgements = {
        ...simulation.weekRecapAcknowledgements,
        [key]: new Date().toISOString(),
      };
    }
    const expiringPlayerIds = new Set(
      (saveState.ok ? saveState.data.expiringContracts : []).map((contract) => contract.id),
    );
    const resolvedNegotiations: Array<{ playerId: string; resolution: 'signed' | 'invalidated' }> =
      [];
    for (const [playerId, negotiation] of Object.entries(simulation.contractNegotiations ?? {})) {
      if (!['ready', 'negotiating'].includes(negotiation.state) || expiringPlayerIds.has(playerId))
        continue;
      const player = userRoster.find((entry) => entry.id === playerId);
      const signed = Boolean(
        player && (player.contractYearsRemaining ?? player.contract?.yearsRemaining ?? 0) > 1,
      );
      negotiation.state = signed ? 'signed' : 'expired';
      negotiation.updatedAt = new Date().toISOString();
      resolvedNegotiations.push({ playerId, resolution: signed ? 'signed' : 'invalidated' });
    }
    const reSignCandidates = saveState.ok
      ? rankReSignReadyCandidates({
          teamAbbr: metadata.teamAbbr.toUpperCase(),
          season: simulation.season,
          roster: saveState.data.roster,
          expiringContracts: saveState.data.expiringContracts,
          simulation,
        })
      : [];
    const generatedEvents = generateFrontOfficeEvents({
      saveId: input.saveId,
      teamAbbr: metadata.teamAbbr.toUpperCase(),
      previous: previousSimulation,
      current: simulation,
      reSignCandidates,
    });
    const saved = await saveFranchiseSimulation({
      userId: user.id,
      saveId: input.saveId,
      expectedVersion: metadata.version ?? 1,
      simulation,
    });
    if (!saved) {
      return NextResponse.json(
        { error: 'The franchise changed in another request. Refresh and try again.' },
        { status: 409 },
      );
    }
    for (const resolved of resolvedNegotiations) {
      await resolveFrontOfficeEventsForPlayer(
        user.id,
        input.saveId,
        resolved.playerId,
        resolved.resolution,
      );
    }
    await expireFrontOfficeTradeOffers(user.id, input.saveId, simulation.currentWeek);
    const tradeInterest = generatedEvents.find((event) => event.type === 'trade_interest');
    if (tradeInterest && saveState.ok) {
      const phase = simulation.phase.includes('draft')
        ? 'draft'
        : simulation.phase.includes('free')
          ? 'freeAgency'
          : 'manage';
      const result = generateTradeOffers(saveState.data, {
        saveId: input.saveId,
        userTeamAbbr: metadata.teamAbbr.toUpperCase(),
        phase,
        trigger: `simulation-week-${simulation.currentWeek}`,
      });
      const offer =
        result.offers.find(
          (candidate) => candidate.proposingTeamAbbr === tradeInterest.relatedTeamAbbr,
        ) ?? result.offers[0];
      if (offer) {
        const expiresWeek = Math.min(8, simulation.currentWeek + 2);
        await persistFrontOfficeTradeOffer({
          userId: user.id,
          saveId: input.saveId,
          offer,
          createdWeek: simulation.currentWeek,
          expiresWeek,
        });
        generatedEvents.push({
          ...tradeInterest,
          id: `foe_offer_${offer.id}`,
          dedupeKey: `trade-offer:${offer.id}`,
          type: 'trade_offer',
          headline: offer.headline,
          summary: offer.summary,
          relatedTeamAbbr: offer.proposingTeamAbbr,
          tradeOfferId: offer.id,
          actionUrl: `/manage/trades?offer=${encodeURIComponent(offer.id)}`,
          metadata: { expiresWeek, archetype: offer.archetype },
        });
      }
    }
    const events = await persistFrontOfficeEvents(user.id, generatedEvents);
    return NextResponse.json({
      ok: true,
      state: saved.simulation,
      version: saved.version,
      eventCount: events.length,
      events,
      previousWeek: previousSimulation.currentWeek,
    });
  } catch (error) {
    console.error('[front-office:simulate]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to simulate franchise.' },
      { status: 500 },
    );
  }
}
