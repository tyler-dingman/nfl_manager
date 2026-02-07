import { NextResponse } from 'next/server';

import { EXPIRING_CONTRACTS, type ExpiringContractRow } from '@/lib/expiring-contracts';
import { ensureSaveState, getSaveState, getSaveStateResult } from '@/server/api/store';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const parseMoneyMillions = (value: string): number => {
  const stripped = value.replace(/[^0-9.]/g, '');
  const parsed = Number.parseFloat(stripped);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const saveId = searchParams.get('saveId');
  const teamAbbr = searchParams.get('teamAbbr');
  if (!saveId) {
    return NextResponse.json({ ok: true, players: EXPIRING_CONTRACTS });
  }

  if (!getSaveState(saveId) && teamAbbr) {
    ensureSaveState(saveId, teamAbbr);
  }

  const stateResult = getSaveStateResult(saveId);
  if (!stateResult.ok) {
    return NextResponse.json({ ok: false, error: stateResult.error }, { status: 404 });
  }

  const rosterExpiring: ExpiringContractRow[] = stateResult.data.roster
    .filter(
      (player) =>
        player.contract?.expiresAfterSeason === true || player.contractYearsRemaining === 0,
    )
    .map((player) => {
      const apy =
        player.contract?.apy ??
        (player as { year1CapHit?: number }).year1CapHit ??
        parseMoneyMillions(player.capHit);
      const estValue = Math.round(apy * 1_000_000);
      const maxValue = Math.round(estValue * 1.2);
      return {
        id: slugify(`${player.firstName} ${player.lastName} ${player.position}`),
        name: `${player.firstName} ${player.lastName}`,
        pos: player.position,
        teamAbbr: stateResult.data.header.teamAbbr,
        contractType: 'UFA',
        interestPct: 0,
        age: player.age ?? 27,
        estValue,
        currentSalary: Math.round((player.contract?.apy ?? apy) * 1_000_000),
        maxValue,
      };
    });

  const combined = [...(stateResult.data.expiringContracts ?? []), ...rosterExpiring];
  const unique = new Map<string, ExpiringContractRow>();
  combined.forEach((row) => unique.set(row.id, row));

  return NextResponse.json({ ok: true, players: Array.from(unique.values()) });
};
