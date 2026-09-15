import { NextRequest, NextResponse } from 'next/server';

import { getSaveStateResult } from '@/server/api/store';
import { authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { listFrontOfficeEvents } from '@/server/front-office/events-repository';
import { getFrontOfficeSaveMetadata } from '@/server/front-office/repository';
import {
  buildTradeTargets,
  buildTradeTeamOutlooks,
  getUserTradeChips,
} from '@/server/front-office/trades/trade-target-engine';

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  const saveId = request.nextUrl.searchParams.get('saveId');
  if (!saveId) return NextResponse.json({ error: 'saveId is required.' }, { status: 400 });
  const save = getSaveStateResult(saveId);
  if (!save.ok) return NextResponse.json({ error: save.error }, { status: 404 });
  const metadata = await getFrontOfficeSaveMetadata(user.id, saveId);
  if (!metadata) return NextResponse.json({ error: 'Save not found.' }, { status: 404 });
  const teamAbbr = metadata.teamAbbr.toUpperCase();
  const [events] = await Promise.all([listFrontOfficeEvents(user.id, saveId)]);
  const targets = buildTradeTargets(save.data, metadata.simulation ?? null, teamAbbr);
  const outlooks = buildTradeTeamOutlooks(save.data, metadata.simulation ?? null);
  const tradeEvents = events.filter((event) =>
    [
      'trade_rumor',
      'trade_interest',
      'trade_offer',
      'league_transaction',
      'deadline_alert',
    ].includes(event.type),
  );
  const recentTrades = save.data.transactions
    .filter((transaction) => transaction.type === 'trade')
    .slice(-8)
    .reverse();
  const simulationWeek = metadata.simulation?.currentWeek ?? 1;
  return NextResponse.json({
    ok: true,
    season: metadata.season,
    week: simulationWeek,
    deadline: { week: 9, label: 'Tuesday after Week 9 · 4:00 p.m. ET', passed: simulationWeek > 9 },
    team: {
      abbr: teamAbbr,
      capSpace: save.data.header.capSpace,
      rosterSize: save.data.roster.length,
      rosterLimit: save.data.header.rosterLimit,
      tradeChips: getUserTradeChips(save.data, teamAbbr),
    },
    targets,
    outlooks,
    tradeEvents,
    pendingOfferCount: tradeEvents.filter((event) => event.type === 'trade_offer' && !event.readAt)
      .length,
    recentTrades,
  });
}
