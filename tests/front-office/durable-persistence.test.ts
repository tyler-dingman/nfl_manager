import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import net from 'node:net';
import { readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { loadEnvConfig } from '@next/env';
import { NextRequest, NextResponse } from 'next/server';
import { databaseContext } from '../../src/server/auth/database-context';
import { franchiseWorkspace } from '../../src/server/front-office/runtime-context';
import { createFranchiseTransport } from '../../packages/front-office/command-transport';
import { verifyGameCheckpoint } from '../infrastructure/postgres-checkpoint';

loadEnvConfig(process.cwd());
process.env.AUTH_JWT_SECRET ||= 'isolated-front-office-test-secret-32-characters';
let db: ReturnType<typeof postgres>, admin: ReturnType<typeof postgres>;
const schema = `fo_test_${randomUUID().replaceAll('-', '')}`;
const actors = [
  { id: randomUUID(), token: randomUUID() },
  { id: randomUUID(), token: randomUUID() },
];
let queryCount = 0;
const meter = { received: 0, sent: 0, reads: 0, writes: 0, other: 0 };
let routes: any, codec: any, store: any;
let forceCollectionBeforeDraftTransaction = false;
async function invoke(
  handler: any,
  actor = 0,
  saveId?: string,
  body?: object,
  version?: number,
  id: string = randomUUID(),
  extra?: any,
) {
  const started = performance.now(),
    beforeQueries = queryCount;
  const headers: Record<string, string> = {
    Cookie: `dd_session=${actors[actor].token}`,
    'Content-Type': 'application/json',
    'X-Franchise-Command-Id': id,
  };
  if (version !== undefined) headers['X-Franchise-Version'] = String(version);
  const request = new NextRequest(
    `http://localhost/api/${extra?.path ?? 'front-office/test'}${saveId ? `?saveId=${saveId}` : ''}`,
    {
      method: body ? 'POST' : 'GET',
      headers,
      body: body ? JSON.stringify({ ...body, ...(saveId ? { saveId } : {}) }) : undefined,
    },
  );
  const commandDb =
    forceCollectionBeforeDraftTransaction && body && 'draftSessionId' in body
      ? new Proxy(db, {
          get(target, key) {
            if (key === 'begin')
              return async (...args: any[]) => {
                if (!global.gc)
                  throw new Error('Run forced collection regression with --expose-gc');
                for (let cycle = 0; cycle < 10; cycle++) {
                  global.gc();
                  await new Promise<void>((resolve) => setImmediate(resolve));
                }
                return (target.begin as any)(...args);
              };
            return Reflect.get(target, key, target);
          },
        })
      : db;
  const response: Response = await databaseContext.run(commandDb, () =>
    handler(request, extra?.context),
  );
  return {
    response,
    commandId: id,
    elapsedMs: performance.now() - started,
    sqlStatements: queryCount - beforeQueries,
    status: response.status,
    body: await response.json(),
    version: Number(response.headers.get('X-Franchise-Version')),
  };
}
async function create(team = 'KC', actor = 0) {
  return invoke(routes.create, actor, undefined, { teamAbbr: team, fresh: true }, 0, randomUUID(), {
    path: 'saves/create',
  });
}
before(async () => {
  const value = process.env.DATABASE_URL;
  if (!value || !['localhost', '127.0.0.1'].includes(new URL(value).hostname))
    throw Error('Integration tests require localhost PostgreSQL. No remote writes permitted.');
  admin = postgres(value, { max: 1, ssl: false, onnotice: () => {} });
  await admin.unsafe(`CREATE SCHEMA ${schema}`);
  db = postgres(value, {
    max: 1,
    ssl: false,
    onnotice: () => {},
    connection: { search_path: schema },
  });
  for (const file of [
    '001_auth_identity.sql',
    '031_front_office_save_state.sql',
    '032_front_office_events.sql',
    '053_front_office_durable_commands.sql',
  ])
    await db.unsafe(await readFile(`db/migrations/${file}`, 'utf8'));
  await db.end();
  const meteredOptions: postgres.Options<{}> & { socket: () => Promise<net.Socket> } = {
    max: 5,
    debug: (_id, query) => {
      queryCount++;
      if (/^\s*select/i.test(query)) meter.reads++;
      else if (/^\s*(insert|update|delete)/i.test(query)) meter.writes++;
      else meter.other++;
    },
    socket: async () => {
      const socket = net.connect({ host: '127.0.0.1', port: Number(new URL(value).port || 5432) });
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', resolve);
        socket.once('error', reject);
      });
      socket.on('data', (chunk) => {
        meter.received += chunk.length;
      });
      const write = socket.write.bind(socket);
      socket.write = ((chunk: any, ...args: any[]) => {
        meter.sent += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
        return (write as any)(chunk, ...args);
      }) as typeof socket.write;
      return socket;
    },
    ssl: false,
    onnotice: () => {},
    connection: { search_path: schema },
  };
  db = postgres(value, meteredOptions);
  const { tokenHash } = await import('../../src/server/auth/crypto');
  const { SESSION_COOKIE } = await import('../../src/server/auth/http');
  assert.equal(SESSION_COOKIE, 'dd_session');
  for (const actor of actors) {
    await db`INSERT INTO users(id,status) VALUES(${actor.id},'ACTIVE')`;
    await db`INSERT INTO sessions(id,user_id,refresh_token_hash,token_family_id,expires_at) VALUES(${randomUUID()},${actor.id},${tokenHash(actor.token)},${randomUUID()},now()+interval '1 day')`;
  }
  await db.unsafe(
    `CREATE TABLE historical_games(id uuid PRIMARY KEY,espn_event_id text,season int,season_type text,week int,home_team_id text,away_team_id text,kickoff_at timestamptz,kickoff_confirmed boolean,status text,home_score int,away_score int,overtime boolean,venue text,broadcast_network text)`,
  );
  const { createFallbackRegularSeasonSchedule } =
    await import('../../src/server/front-office/calendar');
  const { TEAM_LIST } = await import('../../src/data/teams');
  for (const year of [2026, 2027, 2028]) {
    const games = createFallbackRegularSeasonSchedule(
      TEAM_LIST.map((t) => t.abbr),
      year,
    ).map((g) => ({
      id: randomUUID(),
      season: year,
      season_type: 'REG',
      week: g.week,
      home_team_id: g.homeTeam,
      away_team_id: g.awayTeam,
      kickoff_at: `${year}-09-01T00:00:00Z`,
      kickoff_confirmed: true,
      status: 'SCHEDULED',
      overtime: false,
    }));
    await db`INSERT INTO historical_games ${db(games)}`;
  }
  const boundary = await import('../../src/server/front-office/durable-route');
  const c = await import('../../src/app/api/saves/create/route');
  const recovery = await import('../../src/app/api/front-office/recovery/route');
  const roster = await import('../../src/app/api/roster/route');
  codec = await import('../../src/server/front-office/durable-codec');
  store = await import('../../src/server/api/store');
  routes = {
    create: c.POST,
    recovery: recovery.POST,
    report: recovery.GET,
    roster: roster.GET,
    boundary: boundary.withFranchiseRoute,
  };
});
after(async () => {
  if (db) await db.end();
  if (admin) {
    await admin.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});

test('new franchises persist every team; different owners/saves cannot share a team index', async () => {
  const a = await create(),
    b = await create(),
    c = await create('KC', 1);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(b.status, 200);
  assert.equal(c.status, 200);
  assert.notEqual(a.body.saveId, b.body.saveId);
  assert.notEqual(a.body.saveId, c.body.saveId);
  const conflicting = await databaseContext.run(db, () =>
    routes.roster(
      new NextRequest(`http://localhost/api/roster?saveId=${a.body.saveId}`, {
        headers: { Cookie: `dd_session=${actors[0].token}`, 'X-Franchise-Id': b.body.saveId },
      }),
    ),
  );
  assert.equal(conflicting.status, 400);
  const [row] =
    await db`SELECT state_data,reference_hash,state_checksum FROM front_office_durable_state WHERE user_id=${actors[0].id} AND save_id=${a.body.saveId}`;
  const [refs] =
    await db`SELECT entities FROM front_office_reference_bundles WHERE hash=${row.reference_hash}`;
  assert.equal(codec.checksum(row.state_data), row.state_checksum);
  const decoded = codec.decodeWorkspace(row.state_data, refs.entities);
  assert.equal(Object.keys(decoded.runtime.teamRosters).length, 32);
  assert.equal(Object.keys(decoded.runtime.teamCaps).length, 32);
  const missingPick = structuredClone(decoded.runtime);
  missingPick.draftPickAssets.shift();
  assert.equal(codec.recoveryReport(missingPick, a.body.saveId, 'KC').complete, false);
  assert.deepEqual(
    codec.decodeWorkspace(codec.encodeWorkspace(decoded, refs.entities), refs.entities),
    decoded,
  );
  const foreign = await invoke(routes.roster, 1, a.body.saveId);
  assert.equal(foreign.status, 404);
  const loaded = await invoke(routes.roster, 0, a.body.saveId);
  assert.equal(loaded.status, 200);
  assert.equal(loaded.response.headers.get('cache-control'), 'private, no-store');
});

test('owned command state and receipt commit once; stale and reused commands conflict', async () => {
  const initial = await create('SEA'),
    saveId = initial.body.saveId;
  const command = routes.boundary(async () => {
    const scope = franchiseWorkspace.getStore()!;
    const state = scope.saves.get(scope.saveId)!;
    state.header.capSpace -= 1;
    state.draftPickAssets[0] = { ...state.draftPickAssets[0], owningTeamAbbr: 'KC' };
    return NextResponse.json({ ok: true, cap: state.header.capSpace });
  });
  const commandId = randomUUID();
  const a = await invoke(command, 0, saveId, { action: 'trade' }, 1, commandId);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(a.version, 2);
  const replay = await invoke(command, 0, saveId, { action: 'trade' }, 1, commandId);
  assert.deepEqual(replay.body, a.body);
  assert.equal(
    (await invoke(command, 0, saveId, { action: 'different' }, 1, commandId)).status,
    409,
  );
  assert.equal((await invoke(command, 0, saveId, { action: 'trade' }, 1)).status, 409);
  const results = await Promise.all([
    invoke(command, 0, saveId, { action: 'x' }, 2),
    invoke(command, 0, saveId, { action: 'y' }, 2),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const [count] =
    await db`SELECT count(*)::int AS n FROM front_office_command_receipts WHERE user_id=${actors[0].id} AND save_id=${saveId}`;
  assert.equal(count.n, 3);
});

test('database rollback and failed handlers never publish mutated process state', async () => {
  const initial = await create(),
    id = initial.body.saveId;
  const before =
    await db`SELECT state_checksum FROM front_office_durable_state WHERE save_id=${id}`;
  const broken = routes.boundary(async () => {
    franchiseWorkspace.getStore()!.saves.get(id)!.roster = [];
    throw Error('failure before commit');
  });
  assert.equal((await invoke(broken, 0, id, { action: 'fail' }, 1)).status, 503);
  assert.deepEqual(
    await db`SELECT state_checksum FROM front_office_durable_state WHERE save_id=${id}`,
    before,
  );
  const failure = routes.boundary(async () => {
    franchiseWorkspace.getStore()!.saves.get(id)!.header.capSpace = 999;
    await db`SELECT 1`;
    return NextResponse.json({ ok: false, error: 'invalid move' }, { status: 409 });
  });
  assert.equal((await invoke(failure, 0, id, { action: 'fail' }, 1)).status, 409);
  assert.deepEqual(
    await db`SELECT state_checksum FROM front_office_durable_state WHERE save_id=${id}`,
    before,
  );
  assert.equal(
    store.getSaveState(id),
    undefined,
    'No request state leaked into the process fallback cache',
  );
  const read1 = await invoke(routes.roster, 0, id),
    read2 = await invoke(routes.roster, 0, id);
  assert.deepEqual(read1.body, read2.body);
});

test('legacy data is blocked and preserved; partial candidate cannot migrate', async () => {
  const id = randomUUID();
  const original = { seed: 'legacy-original', currentWeek: 3, teams: {}, games: [] };
  await db`INSERT INTO user_front_office_saves(user_id,save_id,team_abbr,season,simulation_state) VALUES(${actors[0].id},${id},'KC',2026,${db.json(original)})`;
  const blocked = await invoke(routes.roster, 0, id);
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.code, 'FRANCHISE_RECOVERY_REQUIRED');
  store.createSaveState(id, 'KC');
  const report = await invoke(routes.report, 0, id);
  assert.equal(report.body.hasServerCandidate, true);
  assert.equal((await invoke(routes.report, 1, id)).status, 404);
  const inspection = await invoke(
    routes.recovery,
    0,
    id,
    { action: 'inspect', useServerCandidate: true },
    1,
  );
  assert.equal(inspection.status, 200, JSON.stringify(inspection.body));
  assert.equal(inspection.body.migrationStatus, 'RECONCILIATION_REQUIRED');
  const failed = await invoke(routes.recovery, 0, id, { action: 'confirm', confirm: true }, 2);
  assert.equal(failed.status, 409);
  const [saved] =
    await db`SELECT simulation_state FROM user_front_office_saves WHERE save_id=${id}`;
  assert.deepEqual(saved.simulation_state, original);
  const [backup] =
    await db`SELECT legacy_record,migration_status FROM front_office_durable_state WHERE save_id=${id}`;
  assert.deepEqual(backup.legacy_record.simulation_state, original);
  assert.notEqual(backup.migration_status, 'MIGRATED');
});

test('complete explicitly confirmed legacy candidate retains original and migrates atomically', async () => {
  const source = await create();
  const simulationRoute = await import('../../src/app/api/front-office/simulate/route');
  const initialized = await invoke(
    simulationRoute.POST,
    0,
    source.body.saveId,
    { action: 'initialize', target: 'week-1' },
    1,
  );
  assert.equal(initialized.status, 200, JSON.stringify(initialized.body));
  const [row] =
    await db`SELECT d.state_data,r.entities FROM front_office_durable_state d JOIN front_office_reference_bundles r ON r.hash=d.reference_hash WHERE d.save_id=${source.body.saveId}`;
  const candidate = codec.decodeWorkspace(row.state_data, row.entities).runtime;
  const id = randomUUID();
  candidate.header.id = id;
  await db`INSERT INTO user_front_office_saves(user_id,save_id,team_abbr,season) VALUES(${actors[0].id},${id},'KC',2026)`;
  const inspected = await invoke(
    routes.recovery,
    0,
    id,
    {
      action: 'inspect',
      runtime: candidate,
      tradeWorkspaces: [],
      simulation: initialized.body.state,
    },
    1,
  );
  assert.equal(inspected.body.migrationStatus, 'LEGACY_COMPLETE');
  const migrated = await invoke(
    routes.recovery,
    0,
    id,
    {
      action: 'confirm',
      confirm: true,
      attestation: 'I confirm this is my complete recovered franchise state',
    },
    2,
  );
  assert.equal(migrated.status, 200, JSON.stringify(migrated.body));
  const [saved] =
    await db`SELECT migration_status,legacy_record FROM front_office_durable_state WHERE save_id=${id}`;
  assert.equal(saved.migration_status, 'MIGRATED');
  assert.equal(saved.legacy_record.simulation_state, null);
  assert.equal((await invoke(routes.roster, 0, id)).status, 200);
});

test('transport preserves command identity after ambiguous failure and isolates account switches', async () => {
  let seq = 0;
  const t = createFranchiseTransport(() => `test-command-${++seq}`);
  await t.observe(
    '/api/saves/create',
    new Response('{}', { headers: { 'X-Franchise-Id': 'a', 'X-Franchise-Version': '5' } }),
  );
  const init = { method: 'POST', body: JSON.stringify({ saveId: 'a', action: 'pick' }) };
  const one = t.prepare('/api/draft/pick', init);
  const headers = new Headers(one.init.headers);
  assert.equal(headers.get('X-Franchise-Version'), '5');
  await t.observe('/api/draft/pick', new Response('{}', { status: 503 }), one.key);
  assert.equal(
    new Headers(t.prepare('/api/draft/pick', init).init.headers).get('X-Franchise-Command-Id'),
    headers.get('X-Franchise-Command-Id'),
  );
  t.reset();
  assert.equal(
    new Headers(t.prepare('/api/draft/pick', init).init.headers).has('X-Franchise-Version'),
    false,
  );
});

async function loadRuntime(saveId: string, owner = 0) {
  const [row] =
    await db`SELECT d.state_data,r.entities FROM front_office_durable_state d JOIN front_office_reference_bundles r ON r.hash=d.reference_hash WHERE d.user_id=${actors[owner].id} AND d.save_id=${saveId}`;
  return codec.decodeWorkspace(row.state_data, row.entities).runtime;
}

test('real cut, free-agent signing and contract routes survive independent request workspaces', async () => {
  const initial = await create(),
    id = initial.body.saveId;
  const setup = routes.boundary(async () => {
    franchiseWorkspace.getStore()!.saves.get(id)!.offseason.hydrated = true;
    return NextResponse.json({ ok: true });
  });
  await invoke(setup, 0, id, { setup: true }, 1);
  const original = await loadRuntime(id),
    playerId = original.roster[0].id;
  const cut = await import('../../src/app/api/actions/cut-player/route');
  const sign = await import('../../src/app/api/free-agents/sign/route');
  const contract = await import('../../src/app/api/roster/renegotiate/route');
  const removed = await invoke(cut.POST, 0, id, { playerId }, 2);
  assert.equal(removed.status, 200, JSON.stringify(removed.body));
  let loaded = await loadRuntime(id);
  assert.equal(loaded.roster.find((p: any) => p.id === playerId).status, 'Cut');
  assert.equal(loaded.teamRosters.KC.find((p: any) => p.id === playerId).status, 'Cut');
  assert(loaded.freeAgents.some((p: any) => p.id === playerId));
  const signed = await invoke(sign.POST, 0, id, { playerId }, 3);
  assert.equal(signed.status, 200, JSON.stringify(signed.body));
  loaded = await loadRuntime(id);
  assert(loaded.roster.find((p: any) => p.id === playerId).isSignedByUser);
  assert(!loaded.freeAgents.some((p: any) => p.id === playerId));
  const renegotiated = await invoke(
    contract.POST,
    0,
    id,
    { playerId: loaded.roster[1].id, years: 3, apy: 20, guaranteed: 40 },
    4,
  );
  assert.equal(renegotiated.status, 200, JSON.stringify(renegotiated.body));
  const after = await loadRuntime(id);
  assert.equal(store.getSaveState(id), undefined);
  assert(after.transactions.length >= 2);
  assert.equal(after.header.capSpace, after.teamCaps.KC);
});

test('trade proposal workspaces and pick ownership persist across create/add/propose requests', async () => {
  const initial = await create(),
    id = initial.body.saveId;
  const createTrade = await import('../../src/app/api/trades/create/route');
  const add = await import('../../src/app/api/trades/[id]/add-asset/route');
  const propose = await import('../../src/app/api/trades/[id]/propose/route');
  const created = await invoke(createTrade.POST, 0, id, { partnerTeamAbbr: 'SEA' }, 1);
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const tradeId = created.body.trade?.id ?? created.body.id;
  assert(tradeId, JSON.stringify(created.body));
  let runtime = await loadRuntime(id);
  const outgoing = runtime.draftPickAssets
    .filter((p: any) => p.owningTeamAbbr === 'KC')
    .sort((a: any, b: any) => a.round - b.round)[0];
  const incoming = runtime.draftPickAssets
    .filter((p: any) => p.owningTeamAbbr === 'SEA')
    .sort((a: any, b: any) => b.round - a.round)[0];
  let r = await invoke(
    add.POST,
    0,
    id,
    { side: 'send', type: 'pick', pickId: outgoing.id },
    2,
    randomUUID(),
    { context: { params: { id: tradeId } } },
  );
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await invoke(
    add.POST,
    0,
    id,
    { side: 'receive', type: 'pick', pickId: incoming.id },
    3,
    randomUUID(),
    { context: { params: { id: tradeId } } },
  );
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const accepted = await invoke(propose.POST, 0, id, {}, 4, randomUUID(), {
    context: { params: { id: tradeId } },
  });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  assert.equal(accepted.body.accepted, true, JSON.stringify(accepted.body));
  runtime = await loadRuntime(id);
  assert.equal(
    runtime.draftPickAssets.find(
      (p: any) =>
        p.year === incoming.year &&
        p.round === incoming.round &&
        p.originalTeamAbbr === incoming.originalTeamAbbr,
    ).owningTeamAbbr,
    'KC',
  );
  assert.equal(
    runtime.draftPickAssets.find(
      (p: any) =>
        p.year === outgoing.year &&
        p.round === outgoing.round &&
        p.originalTeamAbbr === outgoing.originalTeamAbbr,
    ).owningTeamAbbr,
    'SEA',
  );
});

for (const forceCollection of [false, true])
  test(
    forceCollection
      ? 'forced collection between validation and transaction preserves real draft continuation, RNG and season progression'
      : 'real simulation advances and real draft continuation persist RNG and full results',
    async () => {
      forceCollectionBeforeDraftTransaction = forceCollection;
      try {
        const initial = await create(),
          id = initial.body.saveId;
        const state = await import('../../src/app/api/front-office/state/route');
        const simulation = await import('../../src/app/api/front-office/simulate/route');
        // PUT adapter is called with its real HTTP method.
        const headers = {
          Cookie: `dd_session=${actors[0].token}`,
          'Content-Type': 'application/json',
          'X-Franchise-Command-Id': randomUUID(),
          'X-Franchise-Version': '1',
        };
        const setup = await databaseContext.run(db, () =>
          state.PUT(
            new NextRequest('http://localhost/api/front-office/state', {
              method: 'PUT',
              headers,
              body: JSON.stringify({
                saveId: id,
                teamAbbr: 'KC',
                season: 2026,
                selectedPath: 'full',
                simulationPhase: 'week-1',
              }),
            }),
          ),
        );
        assert.equal(setup.status, 200, await setup.clone().text());
        const initialized = await invoke(
          simulation.POST,
          0,
          id,
          { action: 'initialize', target: 'week-1' },
          2,
        );
        assert.equal(initialized.status, 200, JSON.stringify(initialized.body));
        assert.equal(initialized.body.state.games.length, 272);
        const advanced = await invoke(
          simulation.POST,
          0,
          id,
          { action: 'advance', target: 'week-2' },
          3,
        );
        assert.equal(advanced.status, 200, JSON.stringify(advanced.body));
        assert(advanced.body.state.games.some((g: any) => g.played));
        const get = await invoke(simulation.GET, 0, id);
        assert.deepEqual(get.body.state.games, advanced.body.state.games);
        assert.equal(get.version, 4);
        // Drive remaining lifecycle with the same versioned production functions in owned commands.
        const { advanceSimulation } = await import('../../src/lib/franchise-simulation');
        const { saveFranchiseSimulation, getFrontOfficeSaveMetadata } =
          await import('../../src/server/front-office/repository');
        const drive = routes.boundary(async () => {
          const scope = franchiseWorkspace.getStore()!,
            metadata = (await getFrontOfficeSaveMetadata(scope.userId, id))!;
          let s = metadata.simulation!;
          for (let week = 3; week <= 18; week++) s = advanceSimulation(s, `week-${week}`);
          for (const target of ['wild-card', 'divisional', 'conference', 'super-bowl', 'offseason'])
            s = advanceSimulation(s, target);
          for (const target of [
            'resign_cut',
            'scouting_combine',
            'free_agency',
            'free_agency_open',
            'draft',
          ])
            s = advanceSimulation(s, target);
          scope.saves.get(id)!.offseason.hydrated = true;
          await saveFranchiseSimulation({
            userId: scope.userId,
            saveId: id,
            expectedVersion: metadata.version!,
            simulation: s,
          });
          return NextResponse.json({ ok: true });
        });
        const driven = await invoke(drive, 0, id, { action: 'finish-season' }, 4);
        assert.equal(driven.status, 200, JSON.stringify(driven.body));
        const start = await import('../../src/app/api/draft/session/start/route');
        const advance = await import('../../src/app/api/draft/session/advance/route');
        const draft = await invoke(start.POST, 0, id, { mode: 'real', maxRounds: 1 }, 5);
        assert.equal(draft.status, 200, JSON.stringify(draft.body));
        const progressed = await invoke(
          advance.POST,
          0,
          id,
          { draftSessionId: draft.body.draftSessionId, autoPickUser: false },
          6,
        );
        assert.equal(progressed.status, 200, JSON.stringify(progressed.body));
        if (forceCollection) {
          const replayed = await invoke(
            advance.POST,
            0,
            id,
            { draftSessionId: draft.body.draftSessionId, autoPickUser: false },
            6,
            progressed.commandId,
          );
          assert.equal(replayed.status, 200, JSON.stringify(replayed.body));
          assert.deepEqual(replayed.body, progressed.body);
          const [retained] =
            await db`SELECT version,(SELECT count(*)::int FROM front_office_command_receipts WHERE user_id=${actors[0].id} AND command_id=${progressed.commandId}) receipts FROM user_front_office_saves WHERE user_id=${actors[0].id} AND save_id=${id}`;
          assert.equal(retained.version, 7);
          assert.equal(retained.receipts, 1);
        }

        const loaded = await loadRuntime(id);
        assert.equal(
          loaded.draftSessions[draft.body.draftSessionId].rngState,
          progressed.body.session.rngState,
        );
        assert.equal(
          loaded.draftSessions[draft.body.draftSessionId].currentPickIndex,
          progressed.body.session.currentPickIndex,
        );
        const pickRoute = await import('../../src/app/api/draft/session/pick/route');
        let turn = progressed,
          version = 7;
        while (
          turn.body.session.picks[turn.body.session.currentPickIndex]?.ownerTeamAbbr !== 'KC' &&
          version < 50
        ) {
          turn = await invoke(
            advance.POST,
            0,
            id,
            { draftSessionId: draft.body.draftSessionId, autoPickUser: false },
            version++,
          );
          assert.equal(turn.status, 200, JSON.stringify(turn.body));
        }
        const selected = new Set(turn.body.session.picks.map((p: any) => p.selectedPlayerId));
        const prospect = turn.body.session.prospects.find((p: any) => !selected.has(p.id));
        const picked = await invoke(
          pickRoute.POST,
          0,
          id,
          { draftSessionId: draft.body.draftSessionId, playerId: prospect.id },
          version++,
        );
        assert.equal(picked.status, 200, JSON.stringify(picked.body));
        let current = picked;
        while (current.body.session.status !== 'completed' && version < 100) {
          current = await invoke(
            advance.POST,
            0,
            id,
            { draftSessionId: draft.body.draftSessionId, autoPickUser: true },
            version++,
          );
          assert.equal(current.status, 200, JSON.stringify(current.body));
        }
        assert.equal(current.body.session.status, 'completed');
        const beforeRollover = await loadRuntime(id);
        assert(beforeRollover.roster.some((p: any) => p.id === prospect.id));
        const cpuPick = current.body.session.picks.find((p: any) => p.selectedByTeamAbbr !== 'KC');
        assert(
          beforeRollover.teamRosters[cpuPick.selectedByTeamAbbr].some(
            (p: any) => p.id === cpuPick.selectedPlayerId,
          ),
        );
        const nextSeason = await invoke(
          simulation.POST,
          0,
          id,
          { action: 'advance', target: 'week-1' },
          version++,
        );
        assert.equal(nextSeason.status, 200, JSON.stringify(nextSeason.body));
        assert.equal(nextSeason.body.state.season, 2027);
        const nextRuntime = await loadRuntime(id);
        assert(nextRuntime.draftSessions[draft.body.draftSessionId].finalized);
        assert.deepEqual(
          nextRuntime.draftSessions[draft.body.draftSessionId].picks,
          beforeRollover.draftSessions[draft.body.draftSessionId].picks,
        );
        assert.equal(
          nextRuntime.draftSessions[draft.body.draftSessionId].rngState,
          beforeRollover.draftSessions[draft.body.draftSessionId].rngState,
        );

        assert.equal(
          nextRuntime.roster.find((p: any) => p.id === prospect.id).contractYearsRemaining,
          beforeRollover.roster.find((p: any) => p.id === prospect.id).contractYearsRemaining,
        );
      } finally {
        forceCollectionBeforeDraftTransaction = false;
      }
    },
  );

test('SQL interruption rolls back state, metadata and receipt together', async () => {
  const initial = await create(),
    id = initial.body.saveId;
  const { authDb } = await import('../../src/server/auth/database');
  const before = await db`SELECT version FROM user_front_office_saves WHERE save_id=${id}`;
  const commandId = randomUUID();
  const fail = routes.boundary(async () => {
    franchiseWorkspace.getStore()!.saves.get(id)!.header.capSpace = 12345;
    await authDb()`UPDATE user_front_office_saves SET season=2099 WHERE save_id=${id}`;
    await authDb()`SELECT 1/0`;
    return NextResponse.json({ ok: true });
  });
  assert.equal((await invoke(fail, 0, id, { action: 'interrupt' }, 1, commandId)).status, 503);
  assert.deepEqual(
    await db`SELECT version FROM user_front_office_saves WHERE save_id=${id}`,
    before,
  );
  assert.equal(
    (await db`SELECT season FROM user_front_office_saves WHERE save_id=${id}`)[0].season,
    2026,
  );
  assert.equal(
    (
      await db`SELECT count(*)::int AS n FROM front_office_command_receipts WHERE command_id=${commandId}`
    )[0].n,
    0,
  );
  assert.notEqual((await loadRuntime(id)).header.capSpace, 12345);
});

test('successive committed season rollovers retain traded picks and all draft history', async () => {
  const initial = await create(),
    id = initial.body.saveId;
  const runtime = await loadRuntime(id),
    future = runtime.draftPickAssets.find((p: any) => p.year === 2028 && p.owningTeamAbbr === 'KC');
  const mutate = routes.boundary(async () => {
    const state = franchiseWorkspace.getStore()!.saves.get(id)!;
    state.draftPickAssets.find((p) => p.id === future.id)!.owningTeamAbbr = 'SEA';
    store.syncSaveSimulation(id, { phase: 'week-1', season: 2027 });
    return NextResponse.json({ ok: true });
  });
  assert.equal((await invoke(mutate, 0, id, { action: 'rollover' }, 1)).status, 200);
  let loaded = await loadRuntime(id);
  assert.equal(loaded.header.year, 2027);
  assert.equal(loaded.draftPickAssets.find((p: any) => p.id === future.id).owningTeamAbbr, 'SEA');
  const next = routes.boundary(async () => {
    store.syncSaveSimulation(id, { phase: 'week-1', season: 2028 });
    return NextResponse.json({ ok: true });
  });
  assert.equal((await invoke(next, 0, id, { action: 'rollover' }, 2)).status, 200);
  loaded = await loadRuntime(id);
  assert.equal(loaded.header.year, 2028);
  assert.equal(loaded.draftPickAssets.find((p: any) => p.id === future.id).owningTeamAbbr, 'SEA');
  const retained = runtime.roster.find((p: any) => p.contractYearsRemaining > 2);
  assert.equal(
    loaded.roster.find((p: any) => p.id === retained.id).contractYearsRemaining,
    retained.contractYearsRemaining - 2,
  );
});

test('separate database connection recovers state without process Maps and records storage envelope', async () => {
  const initial = await create(),
    id = initial.body.saveId;
  const second = postgres(process.env.DATABASE_URL!, {
    max: 1,
    ssl: false,
    onnotice: () => {},
    connection: { search_path: schema },
  });
  try {
    const response = await databaseContext.run(second, () =>
      routes.roster(
        new NextRequest(`http://localhost/api/roster?saveId=${id}`, {
          headers: { Cookie: `dd_session=${actors[0].token}` },
        }),
      ),
    );
    assert.equal(response.status, 200);
    assert.equal(store.getSaveState(id), undefined);
    const probe = `(async()=>{const postgres=require('postgres');const {databaseContext}=require('./src/server/auth/database-context');const {GET}=require('./src/app/api/roster/route');const {NextRequest}=require('next/server');const sql=postgres(process.env.DATABASE_URL,{max:1,ssl:false,connection:{search_path:process.env.FO_PROBE_SCHEMA}});try{const r=await databaseContext.run(sql,()=>GET(new NextRequest('http://localhost/api/roster?saveId='+process.env.FO_PROBE_SAVE,{headers:{Cookie:'dd_session='+process.env.FO_PROBE_TOKEN}})));console.log(JSON.stringify({status:r.status,version:r.headers.get('X-Franchise-Version')}));}finally{await sql.end();}})().catch(()=>{process.exitCode=1;});`;
    const restarted = await promisify(execFile)(
      process.execPath,
      ['--import', 'tsx', '-e', probe],
      {
        env: {
          ...process.env,
          FO_PROBE_SCHEMA: schema,
          FO_PROBE_SAVE: id,
          FO_PROBE_TOKEN: actors[0].token,
        },
      },
    );
    assert.deepEqual(JSON.parse(restarted.stdout.trim()), { status: 200, version: '1' });

    const [sizes] =
      await second`SELECT octet_length(d.state_data::text)::int AS mutable_bytes,octet_length(r.entities::text)::int AS shared_reference_bytes,octet_length(c.response_body)::int AS receipt_bytes FROM front_office_durable_state d JOIN front_office_reference_bundles r ON r.hash=d.reference_hash JOIN front_office_command_receipts c ON (c.user_id,c.save_id)=(d.user_id,d.save_id) WHERE d.save_id=${id}`;
    const fullBytes = Buffer.byteLength(JSON.stringify(await loadRuntime(id)));
    console.log(
      'FO-1 measured local envelope',
      JSON.stringify({
        ...sizes,
        full_runtime_bytes: fullBytes,
        create_elapsed_ms: initial.elapsedMs,
        create_sql_statements: initial.sqlStatements,
        create_precommit_ms: Number(
          initial.response.headers.get('Server-Timing')?.match(/dur=([0-9.]+)/)?.[1],
        ),
        roster_response_bytes: Buffer.byteLength(await response.text()),
      }),
    );
  } finally {
    await second.end();
  }
});

test('draft trade acceptance persists ownership and duplicate commands replay once', async () => {
  const created = await create(),
    id = created.body.saveId;
  const start = await import('../../src/app/api/draft/session/start/route');
  const hub = await import('../../src/app/api/draft/trade-hub/route');
  const begun = await invoke(start.POST, 0, id, { mode: 'mock', maxRounds: 1 }, 1);
  assert.equal(begun.status, 200, JSON.stringify(begun.body));
  let send: string, receive: string;
  const fixture = routes.boundary(async () => {
    const session = franchiseWorkspace.getStore()!.saves.get(id)!.draftSessions[
      begun.body.draftSessionId
    ];
    session.isPaused = true;
    const { mockTradeAssets } = await import('../../src/lib/mock-draft-trades');
    const assets = mockTradeAssets(session);
    send = assets.find((p) => p.owningTeamAbbr === 'KC')!.id;
    receive = assets.find((p) => p.owningTeamAbbr === 'SEA')!.id;
    session.tradeState!.offers.push({
      id: 'stored-test-offer',
      team: 'SEA',
      send: [send],
      receive: [receive],
      intent: 'move_up',
      status: 'active',
      reason: 'isolated test fixture',
      createdPick: session.currentPickIndex,
      exchanges: 0,
    });
    return NextResponse.json({ ok: true });
  });
  assert.equal((await invoke(fixture, 0, id, { action: 'fixture' }, 2)).status, 200);
  const commandId = randomUUID(),
    body = {
      action: 'accept',
      draftSessionId: begun.body.draftSessionId,
      offerId: 'stored-test-offer',
    };
  const accepted = await invoke(hub.POST, 0, id, body, 3, commandId);
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  assert.deepEqual((await invoke(hub.POST, 0, id, body, 3, commandId)).body, accepted.body);
  const runtime = await loadRuntime(id),
    session = runtime.draftSessions[begun.body.draftSessionId];
  assert.equal(session.picks.find((p: any) => p.id === receive).ownerTeamAbbr, 'KC');
  assert.equal(session.picks.find((p: any) => p.id === send).ownerTeamAbbr, 'SEA');
  assert.equal((await invoke(hub.POST, 0, id, body, 4)).status, 400);
});

test('header-only save identity participates in command receipts', async () => {
  const a = await create(),
    b = await create();
  const commandId = randomUUID();
  const command = routes.boundary(async () =>
    NextResponse.json({ ok: true, saveId: franchiseWorkspace.getStore()!.saveId }),
  );
  async function headerOnly(id: string) {
    return databaseContext.run(db, () =>
      command(
        new NextRequest('http://localhost/api/front-office/header-command', {
          method: 'POST',
          headers: {
            Cookie: `dd_session=${actors[0].token}`,
            'Content-Type': 'application/json',
            'X-Franchise-Id': id,
            'X-Franchise-Command-Id': commandId,
            'X-Franchise-Version': '1',
          },
          body: '{}',
        }),
      ),
    );
  }
  const first = await headerOnly(a.body.saveId);
  assert.equal(first.status, 200);
  const other = await headerOnly(b.body.saveId);
  assert.equal(other.status, 409);
  const replay = await headerOnly(a.body.saveId);
  assert.equal(replay.status, 200);
  assert.deepEqual(await replay.json(), await first.json());
  assert.equal((await invoke(routes.roster, 0, b.body.saveId)).version, 1);
});

test('create requires version zero and resume is an owned read without a gameplay version increment', async () => {
  const a = await create('SEA'),
    b = await create('SEA');
  const bad = await invoke(
    routes.create,
    0,
    undefined,
    { teamAbbr: 'SEA', fresh: true },
    8,
    randomUUID(),
    { path: 'saves/create' },
  );
  assert.equal(bad.status, 409);
  const resume = await invoke(
    routes.create,
    0,
    a.body.saveId,
    { teamAbbr: 'SEA' },
    0,
    randomUUID(),
    { path: 'saves/create' },
  );
  assert.equal(resume.status, 200);
  assert.equal(resume.body.saveId, a.body.saveId);
  assert.equal(resume.version, 1);
  const latest = await invoke(routes.create, 0, undefined, { teamAbbr: 'SEA' }, 0, randomUUID(), {
    path: 'saves/create',
  });
  assert.equal(latest.body.saveId, b.body.saveId);
  assert.equal(latest.version, 1);
  assert.equal(
    (
      await invoke(routes.create, 1, a.body.saveId, { teamAbbr: 'SEA' }, 0, randomUUID(), {
        path: 'saves/create',
      })
    ).status,
    404,
  );
});

test('every private franchise endpoint authenticates and denies another owner', async () => {
  const created = await create(),
    id = created.body.saveId;
  const files = (await readdir('src/app/api', { recursive: true })).filter((p) =>
    p.endsWith('route.ts'),
  );
  let checked = 0;
  for (const suffix of files) {
    const file = `src/app/api/${suffix}`,
      source = await readFile(file, 'utf8');
    const family = suffix.split('/')[0];
    const privateFamily =
      [
        'actions',
        'draft',
        'franchise',
        'free-agents',
        'saves',
        'roster',
        'trades',
        'trade-offers',
        'trade-block',
      ].includes(family) ||
      (family === 'front-office' && suffix !== 'front-office/calendar/route.ts');
    const wrapped = source.includes('withFranchiseRoute');
    const alias =
      suffix === 'actions/resign-player/route.ts' &&
      source.includes('@/app/api/actions/re-sign/route');
    if (privateFamily) assert(wrapped || alias, `Unprotected franchise route ${file}`);
    if (!wrapped && !alias) continue;
    const handlers = await import(`../../${file}`);
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      if (typeof handlers[method] !== 'function') continue;
      const body = method === 'GET' ? undefined : JSON.stringify({ saveId: id });
      const url = `http://localhost/api/${suffix.replace('/route.ts', '')}?saveId=${id}`;
      const params = {
        params: Promise.resolve(
          Object.fromEntries(
            suffix
              .split('/')
              .filter((segment) => segment.startsWith('[') && segment.endsWith(']'))
              .map((segment) => [segment.slice(1, -1), randomUUID()]),
          ),
        ),
      };
      const unauthenticated = await databaseContext.run(db, () =>
        handlers[method](
          new NextRequest(url, { method, body, headers: { 'Content-Type': 'application/json' } }),
          params,
        ),
      );
      assert.equal(unauthenticated.status, 401, `${method} ${file}`);
      if (file.endsWith('/saves/create/route.ts')) continue;
      const foreign = await databaseContext.run(db, () =>
        handlers[method](
          new NextRequest(url, {
            method,
            body,
            headers: {
              Cookie: `dd_session=${actors[1].token}`,
              'Content-Type': 'application/json',
              'X-Franchise-Command-Id': randomUUID(),
              'X-Franchise-Version': '1',
            },
          }),
          params,
        ),
      );
      if (file === 'src/app/api/saves/route.ts') {
        assert.equal(foreign.status, 200);
        assert(!(await foreign.json()).saves.some((s: any) => s.saveId === id));
      } else assert.equal(foreign.status, 404, `${method} ${file}`);
      checked++;
    }
  }
  assert(checked >= 52);
  console.log('FO-1 private endpoint ownership checks', checked);
});

test('deferred COMMIT failure rolls back runtime, version and command receipt', async () => {
  const initial = await create(),
    id = initial.body.saveId,
    commandId = randomUUID();
  await db.unsafe(
    'CREATE TABLE commit_failure_probe(owner_id uuid REFERENCES users(id) DEFERRABLE INITIALLY DEFERRED)',
  );
  const before = await loadRuntime(id);
  // Route work must use the actual request transaction, not the outer pool.
  const scoped = routes.boundary(async () => {
    const { authDb } = await import('../../src/server/auth/database');
    franchiseWorkspace.getStore()!.saves.get(id)!.header.capSpace -= 9;
    await authDb()`INSERT INTO commit_failure_probe VALUES(${randomUUID()})`;
    return NextResponse.json({ ok: true });
  });
  const failed = await invoke(scoped, 0, id, {}, 1, commandId);
  assert.equal(failed.status, 503);
  assert.deepEqual(await loadRuntime(id), before);
  assert.equal((await invoke(routes.roster, 0, id)).version, 1);
  assert.equal(store.getSaveState(id), undefined);
  const [receipt] =
    await db`SELECT count(*)::int n FROM front_office_command_receipts WHERE command_id=${commandId}`;
  assert.equal(receipt.n, 0);
});

test('local performance measures committed commands, replay, reads and retained storage growth', async () => {
  const records: any[] = [];
  const snapshot = () => ({ ...meter, queries: queryCount });
  async function measure(name: string, operation: () => Promise<any>) {
    const before = snapshot(),
      started = performance.now(),
      result = await operation(),
      after = snapshot();
    assert.equal(result.status, 200, JSON.stringify(result.body));
    records.push({
      name,
      elapsed_ms: performance.now() - started,
      ...Object.fromEntries(
        Object.keys(after).map((k) => [k, (after as any)[k] - (before as any)[k]]),
      ),
    });
    return result;
  }
  const initial = await measure('create', () => create()),
    id = initial.body.saveId;
  const allocation = () =>
    db`SELECT pg_total_relation_size('front_office_durable_state')::int state_relation_bytes,pg_total_relation_size('front_office_reference_bundles')::int reference_relation_bytes,pg_total_relation_size('front_office_command_receipts')::int receipt_relation_bytes`;
  const beforeAllocation = await allocation();
  const command = routes.boundary(async () => {
    const state = franchiseWorkspace.getStore()!.saves.get(id)!;
    state.header.capSpace -= 0.01;
    return NextResponse.json({ ok: true, cap: state.header.capSpace });
  });
  let last: any,
    lastId = '';
  for (let i = 0; i < 5; i++) {
    lastId = randomUUID();
    last = await measure('cap-command', () =>
      invoke(command, 0, id, { action: 'synthetic-cap' }, i + 1, lastId),
    );
  }
  await measure('replay', () => invoke(command, 0, id, { action: 'synthetic-cap' }, 5, lastId));
  const roster = await measure('roster', () => invoke(routes.roster, 0, id));
  const [bytes] =
    await db`SELECT octet_length(state_data::text)::int state_json_bytes,pg_column_size(state_data)::int state_datum_bytes FROM front_office_durable_state WHERE save_id=${id}`;
  const [receipts] =
    await db`SELECT count(*)::int rows,sum(octet_length(response_body))::int bytes FROM front_office_command_receipts WHERE save_id=${id}`;
  console.log(
    'FO-1 command performance',
    JSON.stringify({
      records,
      bytes,
      receipts,
      beforeAllocation,
      afterAllocation: await allocation(),
      roster_json_bytes: Buffer.byteLength(JSON.stringify(roster.body)),
      scope:
        'Warm local direct-route calls; actual loopback PG protocol bytes; committed commands; physical relation allocation includes all synthetic tests. No cloud billing or percentile claim.',
    }),
  );
});

test('additive migration replay preserves every existing legacy and migrated franchise', async () => {
  const legacyId = randomUUID();
  await db`INSERT INTO user_front_office_saves(user_id,save_id,team_abbr,season,simulation_phase) VALUES(${actors[0].id},${legacyId},'KC',2026,'week-3')`;
  const fingerprint = () =>
    db`SELECT count(*)::int saves,md5(string_agg(to_jsonb(s)::text,'' ORDER BY user_id,save_id)) checksum FROM user_front_office_saves s`;
  const before = await fingerprint(),
    migration = await readFile('db/migrations/053_front_office_durable_commands.sql', 'utf8');
  const reserved = await db.reserve();
  try {
    await reserved.unsafe(migration);
    await reserved.unsafe(migration);
  } finally {
    reserved.release();
  }
  assert.deepEqual(await fingerprint(), before);
  const [preserved] =
    await db`SELECT d.migration_status,d.legacy_record=to_jsonb(s) original_unchanged FROM front_office_durable_state d JOIN user_front_office_saves s USING(user_id,save_id) WHERE d.save_id=${legacyId}`;
  assert.equal(preserved.migration_status, 'LEGACY_PARTIAL');
  assert.equal(preserved.original_unchanged, true);
  console.log('FO-1 migration replay preserved synthetic save rows', before[0].saves);
});

test(
  'full owned game checkpoint restores all durable state and command receipts',
  { skip: process.env.PHASE_TWO_SYNTHETIC_DATABASE !== 'true' },
  async () => {
    const metrics = await verifyGameCheckpoint(db, admin, schema);
    assert.ok((metrics.tables.front_office_durable_state as { rows: number }).rows > 0);
    assert.ok((metrics.tables.front_office_command_receipts as { rows: number }).rows > 0);
  },
);
