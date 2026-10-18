import { applicationBackend } from '../persistence/bindings';
import { withD1FranchiseRoute } from './d1-route';
import { randomUUID } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { authDb } from '@/server/auth/database';
import { databaseContext } from '@/server/auth/database-context';
import { TEAM_LIST } from '@/data/teams';
import { franchiseWorkspace, type FranchiseWorkspace } from './runtime-context';
import {
  checksum,
  decodeWorkspace,
  encodeWorkspace,
  referenceBundle,
  validateRuntime,
  type ReferenceBundle,
} from './durable-codec';

type Handler = (...args: any[]) => Promise<Response>;
type Options = { create?: boolean; list?: boolean; recovery?: boolean; reference?: boolean };
class Rejected extends Error {
  constructor(public response: Response) {
    super('Franchise request rejected');
  }
}
function reply(body: unknown, status = 200, saveId?: string, version?: number) {
  const headers: Record<string, string> = { 'Cache-Control': 'private, no-store' };
  if (saveId) headers['X-Franchise-Id'] = saveId;
  if (version !== undefined) headers['X-Franchise-Version'] = String(version);
  return NextResponse.json(body, { status, headers });
}
function reject(
  code: string,
  error: string,
  status: number,
  saveId?: string,
  version?: number,
  extra: object = {},
): never {
  throw new Rejected(reply({ ok: false, code, error, ...extra }, status, saveId, version));
}
export function withFranchiseRoute(handler: Handler, options: Options = {}): Handler {
  const d1 = withD1FranchiseRoute(handler, options);
  const postgres = withPostgresFranchiseRoute(handler, options);
  return async (...args: any[]) => {
    if (franchiseWorkspace.getStore()) return handler(...args);
    return applicationBackend() === 'd1' ? d1(args[0], ...args.slice(1)) : postgres(...args);
  };
}
function withPostgresFranchiseRoute(handler: Handler, options: Options = {}): Handler {
  return async (input: Request, ...args: any[]) => {
    // Compatibility route aliases execute within the same owned transaction/workspace.
    if (franchiseWorkspace.getStore()) return handler(input, ...args);
    const started = performance.now();
    const request = input instanceof NextRequest ? input : new NextRequest(input);
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
      let body: any = {};
      let bodyText: string | undefined;
      if (writable) {
        try {
          // Consume once. A collected Request.clone() can cancel the original stream
          // in affected Node/Undici runtimes while the transaction is being awaited.
          bodyText = await request.text();
          body = JSON.parse(bodyText);
        } catch {
          return reply({ ok: false, error: 'A JSON action payload is required.' }, 400);
        }
      }
      if (!body || typeof body !== 'object' || Array.isArray(body))
        return reply({ ok: false, error: 'An object action payload is required.' }, 400);
      let saveId =
        request.nextUrl.searchParams.get('saveId') ??
        body.saveId ??
        request.headers.get('X-Franchise-Id');
      const requestedIds = [
        request.nextUrl.searchParams.get('saveId'),
        body.saveId,
        request.headers.get('X-Franchise-Id'),
      ].filter((value) => value != null);
      if (new Set(requestedIds).size > 1)
        return reply({ ok: false, error: 'Conflicting franchise IDs.' }, 400);
      if (
        saveId != null &&
        (typeof saveId !== 'string' || saveId.length < 1 || saveId.length > 160)
      )
        return reply({ ok: false, error: 'Invalid saveId.' }, 400);
      if (options.reference && !saveId && !writable)
        return handler(request, ...args).then((response) => {
          response.headers.set('Cache-Control', 'private, no-store');
          return response;
        });
      if (!body || typeof body !== 'object' || Array.isArray(body))
        return reply({ ok: false, error: 'An object action payload is required.' }, 400);
      const commandId = request.headers.get('X-Franchise-Command-Id') ?? body.commandId;
      const expected = Number(
        request.headers.get('X-Franchise-Version') ?? body.expectedVersion ?? NaN,
      );
      if (writable && (typeof commandId !== 'string' || !/^[A-Za-z0-9:_-]{8,160}$/.test(commandId)))
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
        return reply(
          { ok: false, code: 'VERSION_CONFLICT', error: 'Franchise creation requires version 0.' },
          409,
        );
      const hash = checksum({
        saveId: saveId ?? null,
        method: request.method,
        path: request.nextUrl.pathname,
        query: [...request.nextUrl.searchParams],
        body,
        expected,
      });
      return await authDb().begin(
        writable ? '' : 'isolation level repeatable read read only',
        async (transaction) => {
          const db = transaction as unknown as ReturnType<typeof authDb>;
          return databaseContext.run(db, async () => {
            if (options.create) await db`SELECT id FROM users WHERE id=${user.id} FOR UPDATE`;
            if (writable) {
              const [receipt] =
                await db`SELECT save_id,request_hash,result_version,response_status,response_body FROM front_office_command_receipts WHERE user_id=${user.id} AND command_id=${commandId}`;
              if (receipt) {
                if (receipt.request_hash !== hash)
                  reject(
                    'COMMAND_REUSED',
                    'This command ID was already used with different inputs.',
                    409,
                  );
                const [active] =
                  await db`SELECT deleted_at FROM front_office_durable_state WHERE user_id=${user.id} AND save_id=${receipt.save_id}`;
                if (!active || active.deleted_at)
                  reject('SAVE_NOT_FOUND', 'Franchise not found.', 404);
                return reply(
                  JSON.parse(
                    gunzipSync(receipt.response_body, {
                      maxOutputLength: 64 * 1024 * 1024,
                    }).toString(),
                  ),
                  receipt.response_status,
                  receipt.save_id,
                  receipt.result_version,
                );
              }
            }
            const params = await args[0]?.params;
            if (params?.eventId || params?.offerId || body.persistedOfferId) {
              const rows = params?.eventId
                ? await db`SELECT save_id FROM front_office_events WHERE user_id=${user.id} AND id=${params.eventId}`
                : await db`SELECT save_id FROM front_office_trade_offers WHERE user_id=${user.id} AND id=${params?.offerId ?? body.persistedOfferId}`;
              if (!rows[0] || (saveId && rows[0].save_id !== saveId))
                reject('SAVE_NOT_FOUND', 'Owned franchise record not found.', 404);
              saveId = rows[0].save_id;
            }
            if (options.list) {
              // Give the adapter an independent body, not a branch of a cloned stream.
              // Keep the validated text intact so hashing and dispatch use the same input.
              const handlerRequest = writable
                ? new NextRequest(request.url, {
                    method: request.method,
                    headers: request.headers,
                    signal: request.signal,
                    body: bodyText,
                  })
                : request;
              const response = await handler(handlerRequest, ...args);
              response.headers.set('Cache-Control', 'private, no-store');
              return response;
            }
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
                const [latest] =
                  await db`SELECT save_id FROM user_front_office_saves WHERE user_id=${user.id} AND team_abbr=${team} ORDER BY updated_at DESC,save_id LIMIT 1`;
                saveId = latest?.save_id;
              }
              if (!saveId || body.fresh) {
                saveId = randomUUID();
                isNew = true;
              }
            }
            if (!saveId) reject('SAVE_REQUIRED', 'saveId is required.', 400);
            const id = saveId as string;
            const [metadata] = isNew
              ? []
              : await db`SELECT * FROM user_front_office_saves WHERE user_id=${user.id} AND save_id=${id} ${writable ? db`FOR UPDATE` : db``}`;
            if (!isNew && !metadata) reject('SAVE_NOT_FOUND', 'Franchise not found.', 404);
            // Recheck after the row lock: another request may just have committed this ID.
            if (writable && !options.create) {
              const [receipt] =
                await db`SELECT request_hash,response_status,response_body,result_version FROM front_office_command_receipts WHERE user_id=${user.id} AND command_id=${commandId}`;
              if (receipt) {
                if (receipt.request_hash !== hash)
                  reject(
                    'COMMAND_REUSED',
                    'This command ID was already used with different inputs.',
                    409,
                  );
                return reply(
                  JSON.parse(
                    gunzipSync(receipt.response_body, {
                      maxOutputLength: 64 * 1024 * 1024,
                    }).toString(),
                  ),
                  receipt.response_status,
                  id,
                  receipt.result_version,
                );
              }
            }
            const [durable] = isNew
              ? []
              : await db`SELECT * FROM front_office_durable_state WHERE user_id=${user.id} AND save_id=${id}`;
            if (durable?.deleted_at) reject('SAVE_NOT_FOUND', 'Franchise not found.', 404);
            const version = metadata?.version ?? 0;
            if (metadata && body.season !== undefined && body.season !== metadata.season)
              reject(
                'SEASON_CONFLICT',
                'Load the current franchise season before making this change.',
                409,
                id,
                version,
              );
            if (metadata && body.teamAbbr && body.teamAbbr.toUpperCase() !== metadata.team_abbr)
              reject('TEAM_CONFLICT', 'The franchise team cannot be changed.', 409, id, version);
            if (writable && !options.create && expected !== version)
              reject(
                'VERSION_CONFLICT',
                'The franchise changed. Review the latest state before retrying.',
                409,
                id,
                version,
              );
            const status = durable?.migration_status ?? 'LEGACY_PARTIAL';
            if (!isNew && status !== 'MIGRATED' && !options.recovery)
              reject(
                'FRANCHISE_RECOVERY_REQUIRED',
                'This legacy franchise needs reconciliation. Its existing data has been preserved.',
                409,
                id,
                version,
                {
                  migrationStatus: status,
                  recoveryUrl: `/api/front-office/recovery?saveId=${encodeURIComponent(id)}`,
                  report: durable?.recovery_report ?? {
                    missing: ['complete mutable runtime state'],
                  },
                },
              );
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
            let references: ReferenceBundle = {};
            if (!isNew && status === 'MIGRATED') {
              const [bundle] =
                await db`SELECT entities FROM front_office_reference_bundles WHERE hash=${durable.reference_hash}`;
              if (
                !bundle ||
                checksum(bundle.entities) !== durable.reference_hash ||
                checksum(durable.state_data) !== durable.state_checksum
              )
                reject(
                  'FRANCHISE_CORRUPT',
                  'The durable franchise could not be verified. No state was replaced.',
                  503,
                  id,
                  version,
                );
              references = bundle.entities;
              const recovered = decodeWorkspace(durable.state_data, references);
              workspace.saves.set(id, validateRuntime(recovered.runtime, id, metadata.team_abbr));
              workspace.trades = new Map(recovered.trades);
              workspace.teamIndex.set(metadata.team_abbr, id);
            }
            return franchiseWorkspace.run(workspace, async () => {
              // Give the adapter an independent body, not a branch of a cloned stream.
              // Keep the validated text intact so hashing and dispatch use the same input.
              const handlerRequest = writable
                ? new NextRequest(request.url, {
                    method: request.method,
                    headers: request.headers,
                    signal: request.signal,
                    body: bodyText,
                  })
                : request;
              const response = await handler(handlerRequest, ...args);
              const result = await response
                .clone()
                .json()
                .catch(() => null);
              if (!response.ok || result?.ok === false)
                throw new Rejected(
                  reply(
                    result ?? { ok: false, error: 'Franchise action failed.' },
                    response.status,
                    id,
                    version,
                  ),
                );
              if (!writable) return reply(result, response.status, id, version);
              const runtime = workspace.saves.get(id);
              if (runtime && !(options.create && !isNew)) {
                validateRuntime(runtime, id, isNew ? runtime.header.teamAbbr : metadata.team_abbr);
                if (isNew) references = referenceBundle(runtime);
                if (workspace.recoveryReferences) references = workspace.recoveryReferences;
                const refHash = checksum(references);
                const encoded = encodeWorkspace(
                  { runtime, trades: [...workspace.trades] },
                  references,
                );
                await db`INSERT INTO front_office_reference_bundles(hash,schema_version,entities) VALUES(${refHash},1,${db.json(references as any)}) ON CONFLICT DO NOTHING`;
                await db`INSERT INTO front_office_durable_state(user_id,save_id,migration_status,reference_hash,state_data,state_checksum)
                VALUES(${user.id},${id},'MIGRATED',${refHash},${db.json(encoded as any)},${checksum(encoded)})
                ON CONFLICT(user_id,save_id) DO UPDATE SET migration_status='MIGRATED',reference_hash=EXCLUDED.reference_hash,state_data=EXCLUDED.state_data,state_checksum=EXCLUDED.state_checksum,updated_at=now()`;
              } else if (!runtime && !options.recovery)
                reject(
                  'DURABLE_STATE_REQUIRED',
                  'No complete authoritative state was produced.',
                  503,
                  id,
                  version,
                );
              const nextVersion = options.create && !isNew ? version : version + 1;
              if (!(options.create && !isNew))
                await db`UPDATE user_front_office_saves SET version=${nextVersion},updated_at=now() WHERE user_id=${user.id} AND save_id=${id}`;
              const payload =
                result && typeof result === 'object' && !Array.isArray(result)
                  ? { ...result, version: nextVersion }
                  : result;
              if (payload?.state && typeof payload.state === 'object' && 'version' in payload.state)
                payload.state = { ...payload.state, version: nextVersion };
              const serialized = JSON.stringify(payload);
              if (Buffer.byteLength(serialized) > 64 * 1024 * 1024)
                reject(
                  'RESPONSE_TOO_LARGE',
                  'This franchise response exceeds the durable replay limit. No action was committed.',
                  413,
                  id,
                  version,
                );
              const bytes = gzipSync(Buffer.from(serialized), { level: 1 });
              await db`INSERT INTO front_office_command_receipts(user_id,command_id,save_id,request_hash,result_version,response_status,response_body) VALUES(${user.id},${commandId},${id},${hash},${nextVersion},${response.status},${bytes})`;
              // The enclosing transaction must commit before this response is returned to callers.
              const final = reply(payload, response.status, id, nextVersion);
              final.headers.set(
                'Server-Timing',
                `franchise;dur=${(performance.now() - started).toFixed(1)}`,
              );
              return final;
            });
          });
        },
      );
    } catch (error) {
      if (error instanceof Rejected) return error.response;
      if ((error as { name?: string })?.name === 'ZodError')
        return reply(
          { ok: false, code: 'INVALID_ACTION', error: 'Invalid franchise action payload.' },
          400,
        );
      const code = (error as { code?: string })?.code;
      if (code === '23505')
        return reply(
          {
            ok: false,
            code: 'COMMAND_REUSED',
            error: 'The command ID conflicts with a committed request.',
          },
          409,
        );
      console.error('[front-office:durable]', { code: code ?? 'STATE_OR_DATABASE_ERROR' });
      return reply(
        {
          ok: false,
          code: 'FRANCHISE_UNAVAILABLE',
          error:
            'The franchise action was not confirmed. Retry only with the same command ID to check its result.',
        },
        503,
      );
    }
  };
}
