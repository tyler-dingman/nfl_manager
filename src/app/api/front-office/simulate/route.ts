import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { advanceSimulation, createFranchiseSimulation } from '@/lib/franchise-simulation';
import { authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';
import { getSaveStateResult } from '@/server/api/store';
import { getNFLRegularSeasonSchedule } from '@/server/front-office/calendar';
import { generateFrontOfficeEvents } from '@/server/front-office/event-engine';
import {
  expireFrontOfficeTradeOffers,
  persistFrontOfficeEvents,
  persistFrontOfficeTradeOffer,
} from '@/server/front-office/events-repository';
import { generateTradeOffers } from '@/server/logic/trade-offer-generator';
import {
  getFrontOfficeSaveMetadata,
  saveFranchiseSimulation,
} from '@/server/front-office/repository';

const bodySchema = z.object({
  saveId: z.string().min(1).max(160),
  action: z.enum(['initialize', 'advance']),
  target: z.string().min(1).max(40).optional(),
  userTeamOverall: z.number().min(50).max(99).optional(),
});

const normalizeScheduleTeam = (abbr: string) =>
  abbr.toUpperCase() === 'WSH' ? 'WAS' : abbr.toUpperCase();

async function initializeSimulation(input: {
  userId: string;
  saveId: string;
  userTeamOverall?: number;
}) {
  const metadata = await getFrontOfficeSaveMetadata(input.userId, input.saveId);
  if (!metadata) return null;
  if (metadata.simulation) return metadata;
  const schedule = await getNFLRegularSeasonSchedule(metadata.season);
  if (schedule.length < 250) throw new Error(`The ${metadata.season} schedule is incomplete.`);
  const simulation = createFranchiseSimulation({
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
    });
    if (!metadata) return NextResponse.json({ error: 'Save not found.' }, { status: 404 });
    if (input.action === 'initialize') {
      return NextResponse.json({ ok: true, state: metadata.simulation, version: metadata.version });
    }
    if (!input.target || !metadata.simulation) {
      return NextResponse.json({ error: 'target is required.' }, { status: 400 });
    }
    const previousSimulation = metadata.simulation;
    const simulation = advanceSimulation(previousSimulation, input.target);
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
    await expireFrontOfficeTradeOffers(user.id, input.saveId, simulation.currentWeek);
    const generatedEvents = generateFrontOfficeEvents({
      saveId: input.saveId,
      teamAbbr: metadata.teamAbbr.toUpperCase(),
      previous: previousSimulation,
      current: simulation,
    });
    const tradeInterest = generatedEvents.find((event) => event.type === 'trade_interest');
    const saveState = getSaveStateResult(input.saveId);
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
    });
  } catch (error) {
    console.error('[front-office:simulate]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to simulate franchise.' },
      { status: 500 },
    );
  }
}
