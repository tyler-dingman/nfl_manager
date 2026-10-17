import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/server/auth/request';
import { authDb } from '@/server/auth/database';
import { withFranchiseRoute } from '@/server/front-office/durable-route';
async function list(request: NextRequest) {
  const user = await currentUser(request);
  const team =
    request.nextUrl.searchParams.get('teamAbbr') ?? request.nextUrl.searchParams.get('teamId');
  const rows =
    await authDb()`SELECT s.save_id,s.team_abbr,s.season,s.simulation_phase,s.version,s.created_at,d.migration_status,d.deleted_at
    FROM user_front_office_saves s LEFT JOIN front_office_durable_state d ON (d.user_id,d.save_id)=(s.user_id,s.save_id)
    WHERE s.user_id=${user!.id} AND (${team ?? null}::text IS NULL OR s.team_abbr=${team?.toUpperCase() ?? null}) AND d.deleted_at IS NULL ORDER BY s.updated_at DESC,s.save_id`;
  return NextResponse.json({
    ok: true,
    saves: rows.map((s) => ({
      saveId: s.save_id,
      teamAbbr: s.team_abbr,
      year: s.season,
      phase: s.simulation_phase,
      version: s.version,
      createdAt: s.created_at,
      migrationStatus: s.migration_status ?? 'LEGACY_PARTIAL',
      recoveryRequired: s.migration_status !== 'MIGRATED',
    })),
  });
}
export const GET = withFranchiseRoute(list, { list: true });
