import { gunzipSync } from 'node:zlib';
import { Storage } from './core';
import { JsonTree } from './json-tree';
import {
  checksum,
  decodeWorkspace,
  validateRuntime,
} from '../../src/server/front-office/durable-codec';
import type { PostgresExport } from './import';
import type { FranchiseAggregate } from '../../src/server/front-office/d1-context';
/** Offline only: refuse incomplete legacy state instead of inventing a new save. */
export async function importExecutableFranchises(s: Storage, source: PostgresExport) {
  if (source.schema !== 1 || source.mode !== 'SYNTHETIC_REPEATABLE_READ')
    throw Error('Synthetic snapshot required');
  const rows = (name: string) =>
      source.tables.find((t) => t.name === name)?.rows.map((r) => JSON.parse(r)) ?? [],
    saves = rows('user_front_office_saves'),
    durables = rows('front_office_durable_state'),
    references = rows('front_office_reference_bundles'),
    events = rows('front_office_events'),
    offers = rows('front_office_trade_offers');
  let migrated = 0;
  const reconciliation: { owner: string; saveId: string; reason: string }[] = [];
  for (const save of saves) {
    const d = durables.find((r) => r.user_id === save.user_id && r.save_id === save.save_id),
      ref = d ? references.find((r) => r.hash === d.reference_hash) : null;
    if (d?.migration_status !== 'MIGRATED' || !d.state_data || !ref) {
      reconciliation.push({
        owner: save.user_id,
        saveId: save.save_id,
        reason:
          'Complete mutable state and verified reference bundle required; exact source rows retained in app_imports.',
      });
      continue;
    }
    if (checksum(ref.entities) !== d.reference_hash || checksum(d.state_data) !== d.state_checksum)
      throw Error('Franchise import checksum mismatch');
    const decoded = decodeWorkspace(d.state_data, ref.entities),
      runtime = validateRuntime(decoded.runtime, save.save_id, save.team_abbr),
      referenceHash = await s.put(ref.entities),
      version = save.version ?? 0,
      camel = (r: any) =>
        Object.fromEntries(
          Object.entries(r)
            .filter(([k]) => k !== 'user_id')
            .map(([k, v]) => [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), v]),
        );
    const value: FranchiseAggregate = {
      metadata: {
        saveId: save.save_id,
        teamAbbr: save.team_abbr,
        season: save.season,
        selectedPath: save.selected_path,
        simulationPhase: save.simulation_phase,
        initializedAt: save.initialized_at,
        simulation: save.simulation_state,
        version,
      },
      referenceHash,
      encoded: d.state_data,
      events: {},
      offers: {},
    };
    for (const row of events.filter(
      (r) => r.user_id === save.user_id && r.save_id === save.save_id,
    )) {
      const event = camel(row);
      value.events[row.id] = event as any;
    }
    for (const row of offers.filter(
      (r) => r.user_id === save.user_id && r.save_id === save.save_id,
    ))
      value.offers[row.id] = {
        offer: typeof row.offer_data === 'string' ? JSON.parse(row.offer_data) : row.offer_data,
        status: row.status,
        expiresWeek: row.expires_week,
        createdWeek: row.created_week,
      };
    const root = await new JsonTree(s).put(value),
      hash = await s.put({ schema: 1, owner: save.user_id, saveId: save.save_id, version, root }),
      stamp = (v: any) => (v ? new Date(v).getTime() : Date.now());
    await s.batch([
      s.statement(
        'INSERT INTO app_franchise_heads(user_id,save_id,team_abbr,season,phase,version,object_hash,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
        [
          save.user_id,
          save.save_id,
          save.team_abbr,
          save.season,
          runtime.header.phase,
          version,
          hash,
          stamp(save.created_at),
          stamp(save.updated_at),
          d.deleted_at ? stamp(d.deleted_at) : null,
        ],
      ),
      ...['draft', 'trade'].map((kind) =>
        s.statement(
          'INSERT INTO app_franchise_routes(user_id,kind,id,save_id) SELECT ?,?,value,? FROM json_each(?) WHERE 1 ON CONFLICT DO NOTHING',
          [
            save.user_id,
            kind,
            save.save_id,
            JSON.stringify(
              kind === 'draft'
                ? Object.keys(runtime.draftSessions ?? {})
                : decoded.trades.map(([id]) => id),
            ),
          ],
        ),
      ),
    ]);
    for (const receipt of rows('front_office_command_receipts').filter(
      (r) => r.user_id === save.user_id && r.save_id === save.save_id,
    )) {
      const bytes =
          typeof receipt.response_body === 'string' && receipt.response_body.startsWith('\\x')
            ? Buffer.from(receipt.response_body.slice(2), 'hex')
            : Buffer.from(receipt.response_body?.data ?? receipt.response_body),
        body = JSON.parse(gunzipSync(bytes, { maxOutputLength: 8 * 1024 * 1024 }).toString()),
        object = await s.put({
          schema: 1,
          owner: save.user_id,
          command: receipt.command_id,
          saveId: save.save_id,
          version: receipt.result_version,
          requestHash: receipt.request_hash,
          body,
          status: receipt.response_status,
          stateHash: hash,
        });
      await s
        .statement(
          'INSERT INTO app_franchise_commands(user_id,command_id,save_id,request_hash,object_hash,version) VALUES(?,?,?,?,?,?)',
          [
            save.user_id,
            receipt.command_id,
            save.save_id,
            receipt.request_hash,
            object,
            receipt.result_version,
          ],
        )
        .run();
    }
    migrated++;
  }
  return { migrated, reconciliation };
}
