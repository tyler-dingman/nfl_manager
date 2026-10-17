import { z } from 'zod';
import { TEAM_LIST } from '@/data/teams';
import { NextRequest, NextResponse } from 'next/server';
import { authDb } from '@/server/auth/database';
import { withFranchiseRoute } from '@/server/front-office/durable-route';
import { franchiseWorkspace } from '@/server/front-office/runtime-context';
import {
  recoveryReport,
  validateRuntime,
  referenceBundle,
  checksum,
} from '@/server/front-office/durable-codec';
import { initializeNewRuntime } from '@/server/front-office/initial-runtime';

async function serverRecoveryCandidate() {
  const scope = franchiseWorkspace.getStore()!;
  const [owners] =
    await authDb()`SELECT count(*)::int AS n FROM user_front_office_saves WHERE save_id=${scope.saveId}`;
  // Old process Maps have no owner key. Only an unambiguous owned ID can be offered as evidence.
  if (owners.n !== 1) return null;
  const legacy = globalThis as typeof globalThis & {
    __frontOfficeSaveStore?: Map<string, unknown>;
    __frontOfficeTradeStore?: Map<string, { trade?: { saveId?: string } }>;
  };
  const runtime = legacy.__frontOfficeSaveStore?.get(scope.saveId);
  if (!runtime) return null;
  return structuredClone({
    runtime,
    trades: [...(legacy.__frontOfficeTradeStore ?? [])].filter(
      ([, value]) => value.trade?.saveId === scope.saveId,
    ),
  });
}

async function report() {
  const scope = franchiseWorkspace.getStore()!,
    db = authDb();
  const [row] =
    await db`SELECT migration_status,recovery_report,legacy_record,recovery_candidate FROM front_office_durable_state WHERE user_id=${scope.userId} AND save_id=${scope.saveId}`;
  return NextResponse.json({
    ok: true,
    migrationStatus: row?.migration_status ?? 'LEGACY_PARTIAL',
    report: row?.recovery_report ?? { missing: ['complete mutable state'] },
    hasOriginalRecord: Boolean(row?.legacy_record),
    hasRecoveryCandidate: Boolean(row?.recovery_candidate),
    hasServerCandidate: Boolean(await serverRecoveryCandidate()),
    serverCandidateRequiresExplicitInspection: true,
    required: [
      'all 32 team rosters and caps',
      'contracts and picks',
      'free-agent market',
      'draft sessions and RNG',
      'transactions and mutable CPU state',
    ],
    confirmationRequired: true,
    tradeWorkspacesRequired: true,
  });
}
async function reconcile(request: NextRequest) {
  const input = await request.json(),
    scope = franchiseWorkspace.getStore()!,
    db = authDb();
  const [save] =
    await db`SELECT * FROM user_front_office_saves WHERE user_id=${scope.userId} AND save_id=${scope.saveId}`;
  const [existing] =
    await db`SELECT * FROM front_office_durable_state WHERE user_id=${scope.userId} AND save_id=${scope.saveId}`;
  if (existing?.migration_status === 'MIGRATED')
    return NextResponse.json(
      { ok: false, error: 'This franchise is already migrated.' },
      { status: 409 },
    );
  if (!['inspect', 'confirm'].includes(input.action))
    return NextResponse.json({ ok: false, error: 'Use inspect or confirm.' }, { status: 400 });
  const stored = existing?.recovery_candidate;
  const server = input.useServerCandidate === true ? await serverRecoveryCandidate() : null;
  if (input.useServerCandidate === true && !server)
    return NextResponse.json(
      { ok: false, error: 'No unambiguous owner-scoped server candidate is available.' },
      { status: 409 },
    );
  const candidate = input.runtime ?? server?.runtime ?? stored?.runtime ?? stored;
  const trades = input.tradeWorkspaces ?? server?.trades ?? stored?.trades ?? undefined;
  const simulation = input.simulation ?? stored?.simulation ?? save.simulation_state;
  const gameSchema = z
    .object({
      id: z.string().min(1),
      week: z.number().int().positive(),
      seasonType: z.enum(['REG', 'POST']),
      homeTeam: z.string(),
      awayTeam: z.string(),
      played: z.boolean(),
      homeScore: z.number().finite().nullable(),
      awayScore: z.number().finite().nullable(),
      winner: z.string().nullable(),
    })
    .passthrough();
  const simulationSchema = z
    .object({
      seed: z.string().min(1),
      season: z.number().int(),
      currentWeek: z.number().int().nonnegative(),
      phase: z.string().min(1),
      teams: z.record(
        z.string(),
        z
          .object({
            abbr: z.string(),
            conference: z.string(),
            division: z.string(),
            overall: z.number().finite(),
            pointsFor: z.number().finite(),
            pointsAgainst: z.number().finite(),
            record: z
              .object({ wins: z.number(), losses: z.number(), ties: z.number() })
              .passthrough(),
          })
          .passthrough(),
      ),
      games: z.array(gameSchema).min(272),
      draftOrder: z.array(z.string()),
      transactions: z.array(z.unknown()),
      playoffs: z
        .object({
          seeds: z.record(z.string(), z.array(z.string())),
          games: z.array(gameSchema),
          champion: z.string().nullable(),
        })
        .passthrough()
        .nullable(),
      completedAt: z.string().nullable(),
    })
    .passthrough();
  const parsedSimulation = simulationSchema.safeParse(simulation);
  if (
    trades !== undefined &&
    (!Array.isArray(trades) ||
      trades.some(
        (entry: unknown) =>
          !Array.isArray(entry) ||
          entry.length !== 2 ||
          typeof entry[0] !== 'string' ||
          !entry[1] ||
          typeof entry[1] !== 'object' ||
          entry[1].trade?.saveId !== scope.saveId,
      ))
  )
    return NextResponse.json(
      { ok: false, error: 'Trade workspaces must belong to this franchise.' },
      { status: 400 },
    );
  const inspection = recoveryReport(candidate, scope.saveId, save.team_abbr);
  if (
    !parsedSimulation.success ||
    TEAM_LIST.some((team) => !parsedSimulation.data.teams[team.abbr])
  ) {
    inspection.complete = false;
    inspection.missing.push('complete simulation including all 32 teams and continuation seed');
  }
  if (
    parsedSimulation.success &&
    candidate &&
    typeof candidate === 'object' &&
    (candidate as { header?: { year?: number } }).header?.year !== parsedSimulation.data.season
  ) {
    inspection.complete = false;
    inspection.missing.push('runtime and simulation seasons disagree');
  }
  if (
    input.action === 'confirm' &&
    (!Array.isArray(trades) ||
      !input.confirm ||
      !inspection.complete ||
      !input.attestation ||
      input.attestation !== 'I confirm this is my complete recovered franchise state')
  )
    return NextResponse.json(
      {
        ok: false,
        code: 'RECOVERY_INCOMPLETE',
        error: 'A complete recovery candidate and explicit owner confirmation are required.',
        report: inspection,
      },
      { status: 409 },
    );
  if (
    input.runtime !== undefined ||
    input.tradeWorkspaces !== undefined ||
    input.useServerCandidate === true
  )
    await db`INSERT INTO front_office_recovery_evidence(user_id,save_id,candidate,report) VALUES(${scope.userId},${scope.saveId},${db.json({ runtime: candidate ?? null, trades: trades ?? null, simulation: simulation ?? null })},${db.json(inspection)})`;
  await db`INSERT INTO front_office_durable_state(user_id,save_id,migration_status,legacy_record,recovery_candidate,recovery_report)
    VALUES(${scope.userId},${scope.saveId},${inspection.complete ? 'LEGACY_COMPLETE' : 'RECONCILIATION_REQUIRED'},${db.json(save)},${db.json({ runtime: candidate ?? null, trades: trades ?? null, simulation: simulation ?? null })},${db.json(inspection)})
    ON CONFLICT(user_id,save_id) DO UPDATE SET migration_status=EXCLUDED.migration_status,legacy_record=COALESCE(front_office_durable_state.legacy_record,EXCLUDED.legacy_record),recovery_candidate=EXCLUDED.recovery_candidate,recovery_report=EXCLUDED.recovery_report,updated_at=now()`;
  if (input.action === 'inspect')
    return NextResponse.json({
      ok: true,
      migrationStatus: inspection.complete ? 'LEGACY_COMPLETE' : 'RECONCILIATION_REQUIRED',
      report: inspection,
    });
  const recovered = validateRuntime(candidate, scope.saveId, save.team_abbr);
  // Build immutable references in a separate disposable workspace; never replace recovered state.
  const disposable = { ...scope, saves: new Map(), trades: new Map(), teamIndex: new Map() };
  const base = franchiseWorkspace.run(disposable, () =>
    initializeNewRuntime(scope.saveId, save.team_abbr, save.season),
  );
  const refs = referenceBundle(base),
    hash = checksum(refs);
  await db`INSERT INTO front_office_reference_bundles(hash,schema_version,entities) VALUES(${hash},1,${db.json(refs as any)}) ON CONFLICT DO NOTHING`;
  // The route transaction encodes against this bundle rather than treating private changes as base data.
  (scope as typeof scope & { recoveryReferences?: typeof refs }).recoveryReferences = refs;
  await db`UPDATE user_front_office_saves SET simulation_state=${db.json(simulation)},season=${simulation.season},simulation_phase=${simulation.phase} WHERE user_id=${scope.userId} AND save_id=${scope.saveId}`;
  scope.saves.set(scope.saveId, recovered);
  scope.trades = new Map(trades);
  return NextResponse.json({ ok: true, migrationStatus: 'MIGRATED', report: inspection });
}
export const GET = withFranchiseRoute(report, { recovery: true });
export const POST = withFranchiseRoute(reconcile, { recovery: true });
