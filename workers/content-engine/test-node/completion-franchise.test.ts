import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest, NextResponse } from 'next/server';
import { harness } from '../test/harness';
import { Storage, type SqlDatabase } from '../../../packages/storage/core';
import { PrivateObjects, type Bucket } from '../../../packages/storage/objects';
import { instrumentDatabase, requestMetrics } from '../../../packages/storage/instrumentation';
import { JsonTree } from '../../../packages/storage/json-tree';
import { D1AuthRepository } from '../../../packages/storage/auth';
import { withApplicationBindings } from '../../../src/server/persistence/bindings';
import { POST as create } from '../../../src/app/api/saves/create/route';
import { GET as roster } from '../../../src/app/api/roster/route';
import { GET as list } from '../../../src/app/api/saves/route';
import { POST as cut } from '../../../src/app/api/actions/cut-player/route';
import { POST as sign } from '../../../src/app/api/free-agents/sign/route';
import { withFranchiseRoute } from '../../../src/server/front-office/durable-route';
import { franchiseWorkspace } from '../../../src/server/front-office/runtime-context';
import { decodeWorkspace } from '../../../src/server/front-office/durable-codec';
import { getSaveState } from '../../../src/server/api/store';
import { writeFile } from 'node:fs/promises';
test(
  'Front Office actual routes persist owner-scoped D1/R2 commands, replay, rollback, gameplay and restart without PostgreSQL',
  { timeout: 120000 },
  async () => {
    const h = await harness(true);
    try {
      let db = h.binding as unknown as SqlDatabase;
      let objects = new PrivateObjects(
        (await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as Bucket,
        (await h.mf.getR2Bucket('EDITORIAL_BACKUP')) as unknown as Bucket,
      );
      const storage = () => new Storage(db, objects),
        auth = new D1AuthRepository(storage());
      const a = (await auth.createEmailUser({
          email: 'fo-a@example.invalid',
          passwordHash: 'preserved',
        }))!,
        b = (await auth.createEmailUser({
          email: 'fo-b@example.invalid',
          passwordHash: 'preserved',
        }))!;
      for (const [i, user] of [a, b].entries()) {
        await auth.verifyUserEmail(user.id);
        await auth.createSession({ userId: user.id, token: `synthetic-franchise-${i}` });
      }
      const measurements: any[] = [];
      const invoke = async (
        handler: any,
        actor = 0,
        id?: string,
        body?: any,
        version?: number,
        command = crypto.randomUUID(),
        path = 'front-office/test',
      ) => {
        const metrics = requestMetrics();
        const started = performance.now(),
          request = new NextRequest(`http://localhost/api/${path}${id ? `?saveId=${id}` : ''}`, {
            method: body ? 'POST' : 'GET',
            headers: {
              cookie: `dd_session=synthetic-franchise-${actor}`,
              'content-type': 'application/json',
              'X-Franchise-Command-Id': command,
              ...(version === undefined ? {} : { 'X-Franchise-Version': String(version) }),
            },
            ...(body ? { body: JSON.stringify({ ...body, ...(id ? { saveId: id } : {}) }) } : {}),
          });
        const response = await withApplicationBindings(
          {
            db: instrumentDatabase(db, metrics),
            objects,
            env: {
              APP_DATA_BACKEND: 'd1',
              APP_RUNTIME: 'node',
              AUTH_BASE_URL: 'http://localhost',
              DATABASE_URL: '',
              AUTH_JWT_SECRET: 'synthetic-franchise-only-secret-at-least-32-characters',
            },
          },
          () => handler(request),
        );
        const json = await response.json();
        measurements.push({
          path,
          status: response.status,
          localWallMs: performance.now() - started,
          ...metrics,
        });
        assert(metrics.statements <= 50, 'Tested command exceeds D1 Free statement ceiling');
        return {
          status: response.status,
          body: json,
          version: Number(response.headers.get('X-Franchise-Version')),
        };
      };
      const load = async (owner: string, id: string) => {
        const [head] = await storage().rows<any>(
          'SELECT * FROM app_franchise_heads WHERE user_id=? AND save_id=?',
          [owner, id],
        );
        const envelope = await storage().get<any>(head.object_hash);
        const value = await new JsonTree(storage()).get<any>(envelope.root);
        const refs = await storage().get<any>(value.referenceHash);
        return { head, value, runtime: decodeWorkspace(value.encoded, refs).runtime };
      };
      const first = await invoke(
        create,
        0,
        undefined,
        { teamAbbr: 'KC', fresh: true },
        0,
        crypto.randomUUID(),
        'saves/create',
      );
      assert.equal(first.status, 200, JSON.stringify(first.body));
      const id = first.body.saveId;
      assert.equal(first.version, 1);
      const initial = await load(a.id, id);
      assert.equal(Object.keys(initial.runtime.teamRosters).length, 32);
      assert.equal(getSaveState(id), undefined);
      assert.equal((await invoke(roster, 1, id)).status, 404);
      assert.equal((await invoke(roster, 0, id)).status, 200);
      const setup = withFranchiseRoute(async () => {
        franchiseWorkspace.getStore()!.saves.get(id)!.offseason.hydrated = true;
        return NextResponse.json({ ok: true });
      });
      assert.equal((await invoke(setup, 0, id, { setup: true }, 1)).status, 200);
      const player = (await load(a.id, id)).runtime.roster[0].id,
        command = crypto.randomUUID();
      const removed = await invoke(cut, 0, id, { playerId: player }, 2, command);
      assert.equal(removed.status, 200, JSON.stringify(removed.body));
      assert.equal(
        (await load(a.id, id)).runtime.roster.find((p) => p.id === player)!.status,
        'Cut',
      );
      const duplicate = await invoke(cut, 0, id, { playerId: player }, 2, command);
      assert.equal(duplicate.status, 200);
      assert.deepEqual(duplicate.body, removed.body);
      assert.equal((await invoke(cut, 0, id, { playerId: 'different' }, 2, command)).status, 409);
      assert.equal((await invoke(sign, 0, id, { playerId: player }, 3)).status, 200);
      assert((await load(a.id, id)).runtime.roster.find((p) => p.id === player)!.isSignedByUser);
      const before = (await load(a.id, id)).head;
      const failure = withFranchiseRoute(async () => {
        franchiseWorkspace.getStore()!.saves.get(id)!.header.capSpace = 123;
        return NextResponse.json({ ok: false, error: 'Synthetic failure' }, { status: 422 });
      });
      assert.equal((await invoke(failure, 0, id, { failure: true }, 4)).status, 422);
      assert.deepEqual((await load(a.id, id)).head, before);
      const update = withFranchiseRoute(async () => {
        franchiseWorkspace.getStore()!.saves.get(id)!.header.phase = 'DRAFT';
        return NextResponse.json({ ok: true });
      });
      const race = await Promise.all([
        invoke(update, 0, id, { advance: true }, 4),
        invoke(update, 0, id, { advance: true }, 4),
      ]);
      assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
      assert.equal((await load(a.id, id)).head.version, 5);
      const records = await invoke(
        list,
        0,
        undefined,
        undefined,
        undefined,
        crypto.randomUUID(),
        'saves',
      );
      assert.equal(records.body.saves[0].saveId, id);
      db = (await h.restart()) as unknown as SqlDatabase;
      objects = new PrivateObjects(
        (await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as Bucket,
        (await h.mf.getR2Bucket('EDITORIAL_BACKUP')) as unknown as Bucket,
      );
      assert.equal((await invoke(roster, 0, id)).status, 200);
      assert.equal((await load(a.id, id)).head.version, 5);
      assert.equal((await storage().rows('PRAGMA foreign_key_check')).length, 0);
      await writeFile(
        new URL('../../../reports/production-completion/franchise-routes.json', import.meta.url),
        JSON.stringify(
          {
            scope:
              'MEASURED synthetic Next handlers on D1/R2, DATABASE_URL empty; local wall time not production CPU',
            measurements,
            r2Reads: objects.reads,
            r2Writes: objects.writes,
            postgresUsed: false,
          },
          null,
          2,
        ) + '\n',
      );
    } finally {
      await h.close();
    }
  },
);
