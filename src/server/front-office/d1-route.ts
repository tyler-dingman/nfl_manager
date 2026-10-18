import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '../auth/request';
import { assertSameOrigin } from '../auth/http';
import { applicationStorage } from '../persistence/bindings';
import { JsonTree } from '../../../packages/storage/json-tree';
import { Storage } from '../../../packages/storage/core';
import { TEAM_LIST } from '@/data/teams';
import { franchiseWorkspace, type FranchiseWorkspace } from './runtime-context';
import { d1Franchise, type FranchiseAggregate } from './d1-context';
import {
  checksum,
  referenceBundle,
  encodeWorkspace,
  decodeWorkspace,
  validateRuntime,
} from './durable-codec';
type Options = { create?: boolean; list?: boolean; recovery?: boolean; reference?: boolean };
type Head = {
  save_id: string;
  team_abbr: string;
  season: number;
  phase: string;
  version: number;
  object_hash: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
};
const reply = (body: unknown, status = 200, id?: string, version?: number) =>
  NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      ...(id ? { 'X-Franchise-Id': id } : {}),
      ...(version !== undefined ? { 'X-Franchise-Version': String(version) } : {}),
    },
  });
class Rejected extends Error {
  constructor(readonly response: Response) {
    super('Franchise command rejected');
  }
}
const reject = (
  code: string,
  error: string,
  status: number,
  id?: string,
  version?: number,
): never => {
  throw new Rejected(reply({ ok: false, code, error }, status, id, version));
};
export function withD1FranchiseRoute(
  handler: (...args: any[]) => Promise<Response>,
  options: Options = {},
) {
  return async (input: Request, ...args: any[]) => {
    const request = input instanceof NextRequest ? input : new NextRequest(input),
      s = applicationStorage();
    try {
      const user = await currentUser(request);
      if (!user)
        return reply(
          { ok: false, code: 'UNAUTHORIZED', error: 'Sign in to access your franchise.' },
          401,
        );
      const writable = !['GET', 'HEAD'].includes(request.method);
      if (writable) {
        try {
          assertSameOrigin(request);
        } catch {
          return reply({ ok: false, error: 'Invalid request origin.' }, 403);
        }
      }
      let body: any = {},
        text: string | undefined;
      if (writable) {
        try {
          text = await request.text();
          body = JSON.parse(text);
        } catch {
          return reply({ ok: false, error: 'A JSON action payload is required.' }, 400);
        }
      }
      if (!body || typeof body !== 'object' || Array.isArray(body))
        return reply({ ok: false, error: 'An object action payload is required.' }, 400);
      const commands = request.headers.get('X-Franchise-Command-Id') ?? body.commandId;
      const expected = Number(
        request.headers.get('X-Franchise-Version') ?? body.expectedVersion ?? NaN,
      );
      const requested = [
        request.nextUrl.searchParams.get('saveId'),
        body.saveId,
        request.headers.get('X-Franchise-Id'),
      ].filter((v) => v != null);
      if (new Set(requested).size > 1)
        return reply({ ok: false, error: 'Conflicting franchise IDs.' }, 400);
      let saveId = requested[0] as string | undefined;
      if (
        saveId !== undefined &&
        (typeof saveId !== 'string' || saveId.length < 1 || saveId.length > 160)
      )
        return reply({ ok: false, error: 'Invalid saveId.' }, 400);
      if (writable && (typeof commands !== 'string' || !/^[A-Za-z0-9:_-]{8,160}$/.test(commands)))
        return reply(
          {
            ok: false,
            code: 'COMMAND_REQUIRED',
            error: 'A unique franchise command ID is required.',
          },
          428,
        );
      if (writable && (!Number.isSafeInteger(expected) || expected < 0))
        return reply(
          {
            ok: false,
            code: 'VERSION_REQUIRED',
            error: 'Load the franchise and provide its expected version.',
          },
          428,
        );
      if (writable && options.create && expected !== 0)
        reject('VERSION_CONFLICT', 'Franchise creation requires version 0.', 409);
      const requestHash = checksum({
        saveId: saveId ?? null,
        method: request.method,
        path: request.nextUrl.pathname,
        query: [...request.nextUrl.searchParams],
        body,
        expected,
      });
      const replay = async () => {
        const [receipt] = await s.rows<any>(
          'SELECT c.*,h.deleted_at FROM app_franchise_commands c JOIN app_franchise_heads h ON h.user_id=c.user_id AND h.save_id=c.save_id WHERE c.user_id=? AND c.command_id=?',
          [user.id, commands],
        );
        if (!receipt) return null;
        if (receipt.request_hash !== requestHash)
          reject('COMMAND_REUSED', 'This command ID was already used with different inputs.', 409);
        if (receipt.deleted_at) reject('SAVE_NOT_FOUND', 'Franchise not found.', 404);
        const envelope = await s.get<any>(receipt.object_hash);
        if (
          envelope.owner !== user.id ||
          envelope.command !== commands ||
          envelope.saveId !== receipt.save_id ||
          envelope.version !== receipt.version ||
          envelope.requestHash !== requestHash
        )
          throw Error('Franchise receipt identity mismatch');
        return reply(envelope.body, envelope.status, receipt.save_id, receipt.version);
      };
      if (writable) {
        const prior = await replay();
        if (prior) return prior;
      }
      const params = await args[0]?.params;
      if (params?.eventId || params?.offerId || body.persistedOfferId) {
        const kind = params?.eventId ? 'event' : 'offer',
          id = params?.eventId ?? params?.offerId ?? body.persistedOfferId;
        const [route] = await s.rows<{ save_id: string }>(
          'SELECT save_id FROM app_franchise_routes WHERE user_id=? AND kind=? AND id=?',
          [user.id, kind, id],
        );
        if (!route || (saveId && saveId !== route.save_id))
          reject('SAVE_NOT_FOUND', 'Owned franchise record not found.', 404);
        saveId = route.save_id;
      }
      if (options.list) {
        const team =
          request.nextUrl.searchParams.get('teamAbbr') ??
          request.nextUrl.searchParams.get('teamId');
        const rows = await s.rows<Head>(
          'SELECT * FROM app_franchise_heads WHERE user_id=? AND deleted_at IS NULL AND (? IS NULL OR team_abbr=?) ORDER BY updated_at DESC,save_id',
          [user.id, team?.toUpperCase() ?? null, team?.toUpperCase() ?? null],
        );
        return reply({
          ok: true,
          saves: rows.map((r) => ({
            saveId: r.save_id,
            teamAbbr: r.team_abbr,
            year: r.season,
            phase: r.phase,
            version: r.version,
            createdAt: new Date(r.created_at).toISOString(),
            migrationStatus: 'MIGRATED',
            recoveryRequired: false,
          })),
        });
      }
      if (options.reference && !saveId && !writable) return handler(request, ...args);
      let isNew = false;
      if (options.create) {
        const team = String(body.teamAbbr ?? body.teamId ?? '').toUpperCase();
        if (
          !TEAM_LIST.some((t) => t.abbr === team) ||
          (body.year !== undefined &&
            (!Number.isInteger(body.year) || body.year < 1920 || body.year > 2200))
        )
          reject('INVALID_TEAM', 'A valid team and season are required.', 400);
        if (!body.fresh && !saveId) {
          const [head] = await s.rows<Head>(
            'SELECT * FROM app_franchise_heads WHERE user_id=? AND team_abbr=? AND deleted_at IS NULL ORDER BY updated_at DESC,save_id LIMIT 1',
            [user.id, team],
          );
          saveId = head?.save_id;
        }
        if (!saveId || body.fresh) {
          saveId = crypto.randomUUID();
          isNew = true;
        }
      }
      if (!saveId) reject('SAVE_REQUIRED', 'saveId is required.', 400);
      const id = saveId as string;
      const [head] = isNew
        ? []
        : await s.rows<Head>('SELECT * FROM app_franchise_heads WHERE user_id=? AND save_id=?', [
            user.id,
            id,
          ]);
      if (!isNew && (!head || head.deleted_at))
        reject('SAVE_NOT_FOUND', 'Franchise not found.', 404);
      const version = head?.version ?? 0;
      if (writable && !options.create && expected !== version)
        reject(
          'VERSION_CONFLICT',
          'The franchise changed. Review the latest state before retrying.',
          409,
          id,
          version,
        );
      if (head && body.season !== undefined && body.season !== head.season)
        reject(
          'SEASON_CONFLICT',
          'Load the current franchise season before making this change.',
          409,
          id,
          version,
        );
      if (head && body.teamAbbr && body.teamAbbr.toUpperCase() !== head.team_abbr)
        reject('TEAM_CONFLICT', 'The franchise team cannot be changed.', 409, id, version);
      let value: FranchiseAggregate;
      if (head) {
        const envelope = await s.get<any>(head.object_hash);
        if (
          envelope.schema !== 1 ||
          envelope.owner !== user.id ||
          envelope.saveId !== id ||
          envelope.version !== version
        )
          throw Error('Franchise envelope mismatch');
        value = await new JsonTree(s).get(envelope.root);
        if (
          value.metadata.saveId !== id ||
          value.metadata.teamAbbr !== head.team_abbr ||
          value.metadata.version !== version
        )
          throw Error('Franchise metadata identity mismatch');
      } else
        value = {
          metadata: {
            saveId: id,
            teamAbbr: String(body.teamAbbr ?? body.teamId).toUpperCase(),
            season: body.year ?? 2026,
            selectedPath: null,
            simulationPhase: null,
            initializedAt: null,
            simulation: null,
            version: 0,
          },
          encoded: null,
          referenceHash: '',
          events: {},
          offers: {},
        };
      const workspace: FranchiseWorkspace = {
        userId: user.id,
        user,
        saveId: id,
        version,
        saves: new Map(),
        trades: new Map(),
        teamIndex: new Map(),
        writable,
      };
      if (head) {
        const references = await s.get<any>(value.referenceHash),
          decoded = decodeWorkspace(value.encoded, references);
        workspace.saves.set(id, validateRuntime(decoded.runtime, id, head.team_abbr));
        workspace.trades = new Map(decoded.trades);
        workspace.teamIndex.set(head.team_abbr, id);
      }
      if (options.recovery) {
        if (!writable)
          return reply({
            ok: true,
            migrationStatus: 'MIGRATED',
            hasOriginalRecord: true,
            hasRecoveryCandidate: false,
            hasServerCandidate: false,
            report: { missing: [] },
            confirmationRequired: true,
            tradeWorkspacesRequired: true,
          });
        return reply({ ok: false, error: 'This franchise is already migrated.' }, 409, id, version);
      }
      const oldEvents = new Set(Object.keys(value.events)),
        oldOffers = new Set(Object.keys(value.offers));
      return await d1Franchise.run({ owner: user.id, value, writable }, () =>
        franchiseWorkspace.run(workspace, async () => {
          const handlerRequest = writable
            ? new NextRequest(request.url, {
                method: request.method,
                headers: request.headers,
                signal: request.signal,
                body: text,
              })
            : request;
          const response = await handler(handlerRequest, ...args),
            result = await response.json().catch(() => null);
          if (!response.ok || result?.ok === false)
            return reply(
              result ?? { ok: false, error: 'Franchise action failed.' },
              response.status,
              id,
              version,
            );
          if (!writable) return reply(result, response.status, id, version);
          const runtime = workspace.saves.get(id);
          if (!runtime)
            reject(
              'DURABLE_STATE_REQUIRED',
              'No complete authoritative state was produced.',
              503,
              id,
              version,
            );
          validateRuntime(runtime!, id, value.metadata.teamAbbr);
          const nextVersion = options.create && !isNew ? version : version + 1;
          value.metadata.version = nextVersion;
          const references = isNew
            ? referenceBundle(runtime!)
            : await s.get<any>(value.referenceHash);
          value.referenceHash = await s.put(workspace.recoveryReferences ?? references);
          value.encoded = encodeWorkspace(
            { runtime: runtime!, trades: [...workspace.trades] },
            workspace.recoveryReferences ?? references,
          );
          const root = await new JsonTree(s).put(value),
            hash = await s.put({
              schema: 1,
              owner: user.id,
              saveId: id,
              version: nextVersion,
              root,
            });
          const payload =
            result && typeof result === 'object' && !Array.isArray(result)
              ? { ...result, version: nextVersion }
              : result;
          if (payload?.state && typeof payload.state === 'object' && 'version' in payload.state)
            payload.state = { ...payload.state, version: nextVersion };
          const receiptHash = await s.put({
            schema: 1,
            owner: user.id,
            command: commands,
            saveId: id,
            version: nextVersion,
            requestHash,
            body: payload,
            status: response.status,
            stateHash: hash,
          });
          const nonce = crypto.randomUUID(),
            now = Date.now();
          const write = isNew
            ? s.statement(
                'INSERT INTO app_franchise_heads(user_id,save_id,team_abbr,season,phase,version,object_hash,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,? WHERE ? OR NOT EXISTS(SELECT 1 FROM app_franchise_heads WHERE user_id=? AND team_abbr=? AND deleted_at IS NULL)',
                [
                  user.id,
                  id,
                  value.metadata.teamAbbr,
                  value.metadata.season,
                  value.metadata.simulationPhase ?? runtime!.header.phase,
                  nextVersion,
                  hash,
                  now,
                  now,
                  body.fresh ? 1 : 0,
                  user.id,
                  value.metadata.teamAbbr,
                ],
              )
            : s.statement(
                'UPDATE app_franchise_heads SET season=?,phase=?,version=?,object_hash=?,updated_at=? WHERE user_id=? AND save_id=? AND version=? AND deleted_at IS NULL',
                [
                  value.metadata.season,
                  value.metadata.simulationPhase ?? runtime!.header.phase,
                  nextVersion,
                  hash,
                  now,
                  user.id,
                  id,
                  version,
                ],
              );
          const statements = [write, s.guard(nonce), s.unguard(nonce)];
          for (const [kind, ids] of [
            ['event', Object.keys(value.events).filter((id) => !oldEvents.has(id))],
            ['offer', Object.keys(value.offers).filter((id) => !oldOffers.has(id))],
          ] as const)
            if (ids.length)
              statements.push(
                s.statement(
                  'INSERT INTO app_franchise_routes(user_id,kind,id,save_id) SELECT ?,?,value,? FROM json_each(?) WHERE 1 ON CONFLICT(user_id,kind,id) DO UPDATE SET save_id=CASE WHEN save_id=excluded.save_id THEN save_id ELSE NULL END',
                  [user.id, kind, id, JSON.stringify(ids)],
                ),
              );
          statements.push(
            s.statement(
              'INSERT INTO app_franchise_commands(user_id,command_id,save_id,request_hash,object_hash,version) VALUES(?,?,?,?,?,?)',
              [user.id, commands, id, requestHash, receiptHash, nextVersion],
            ),
          );
          try {
            await s.batch(statements);
          } catch (error) {
            const prior = await replay();
            if (prior) return prior;
            const [current] = await s.rows<Head>(
              'SELECT * FROM app_franchise_heads WHERE user_id=? AND save_id=?',
              [user.id, id],
            );
            if (current?.version !== version)
              reject(
                'VERSION_CONFLICT',
                'The franchise changed. Review the latest state before retrying.',
                409,
                id,
                current?.version,
              );
            throw error;
          }
          return reply(payload, response.status, id, nextVersion);
        }),
      );
    } catch (error) {
      if (error instanceof Rejected) return error.response;
      if ((error as any)?.name === 'ZodError')
        return reply(
          { ok: false, code: 'INVALID_ACTION', error: 'Invalid franchise action payload.' },
          400,
        );
      console.error('[front-office:d1]', { code: 'STATE_OR_STORAGE_ERROR' });
      if (process.env.NODE_ENV === 'test') console.error(error);
      return reply(
        {
          ok: false,
          code: 'FRANCHISE_UNAVAILABLE',
          error: 'The action was not confirmed. Retry only with the same command ID.',
        },
        503,
      );
    }
  };
}
