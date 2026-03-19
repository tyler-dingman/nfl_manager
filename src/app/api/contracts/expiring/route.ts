import { NextResponse } from 'next/server';

import type { ExpiringContractRow } from '@/lib/expiring-contracts';
import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';
import { getExpiringContractsForTeam } from '@/server/logic/expiring-contracts';
import {
  ensureSaveState,
  getSaveState,
  getSaveStateResult,
  hydrateOffseasonFreeAgencyState,
} from '@/server/api/store';
import { calculatePlayerInterestForTeam } from '@/lib/signing-interest';
import { buildInterestQuote } from '@/lib/expiring-interest-quotes';

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const saveId = searchParams.get('saveId');
  const teamAbbr = searchParams.get('teamAbbr');
  if (!saveId) {
    const defaultTeamAbbr = teamAbbr?.toUpperCase() ?? 'KC';
    return NextResponse.json({
      ok: true,
      players: getExpiringContractsForTeam(defaultTeamAbbr, NFL_LEAGUE_DATA),
    });
  }

  if (!getSaveState(saveId) && teamAbbr) {
    ensureSaveState(saveId, teamAbbr);
  }

  const stateResult = getSaveStateResult(saveId);
  if (!stateResult.ok) {
    return NextResponse.json({ ok: false, error: stateResult.error }, { status: 404 });
  }

  await hydrateOffseasonFreeAgencyState(stateResult.data);

  const combined = [...(stateResult.data.expiringContracts ?? [])];
  const unique = new Map<string, ExpiringContractRow>();
  combined.forEach((row) => unique.set(row.id, row));

  const players = Array.from(unique.values())
    .map((row) => {
      const sourceRosterPlayer = stateResult.data.roster.find((player) => player.id === row.id);
      const interestBreakdown = calculatePlayerInterestForTeam(
        {
          position: row.pos,
          age: row.age,
          rating: row.rating ?? sourceRosterPlayer?.rating,
        },
        { teamAbbr: stateResult.data.header.teamAbbr, roster: stateResult.data.roster },
        { previousTeamAbbr: row.lastTeamAbbr ?? row.previousTeamAbbr },
      );

      return {
        ...row,
        rating: row.rating ?? sourceRosterPlayer?.rating,
        headshotUrl: row.headshotUrl ?? sourceRosterPlayer?.headshotUrl ?? null,
        interestPct: interestBreakdown.finalInterest,
      };
    })
    .map((row, _, rows) => {
      const samePositionTeammateFirstNames = rows
        .filter(
          (teammate) =>
            teammate.id !== row.id &&
            teammate.pos.trim().toUpperCase() === row.pos.trim().toUpperCase(),
        )
        .map((teammate) => teammate.name.split(/\s+/)[0] ?? '')
        .filter(Boolean);

      return {
        ...row,
        interestQuote: buildInterestQuote({
          playerId: row.id,
          interestPct: row.interestPct,
          teamAbbr: stateResult.data.header.teamAbbr,
          samePositionTeammateFirstNames,
        }),
      };
    })
    .sort((a, b) => {
      const ratingDelta = (b.rating ?? 0) - (a.rating ?? 0);
      if (ratingDelta !== 0) {
        return ratingDelta;
      }
      return b.estValue - a.estValue;
    });

  return NextResponse.json({ ok: true, players });
};
