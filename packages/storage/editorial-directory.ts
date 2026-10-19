import { type Storage } from './core';
import { MultiD1, DATABASE_OWNERS, type DatabaseOwner, teamDatabase } from './multi-d1';
export const EDITORIAL_OWNERS: readonly DatabaseOwner[] = DATABASE_OWNERS.filter(
  (o) => o !== 'D1_USERS',
);
export const ENTITY_TABLES = {
  story: 'app_editorial_stories',
  public: 'app_public_stories',
  candidate: 'app_editorial_candidates',
  source: 'app_editorial_sources',
  briefing: 'app_daily_briefings',
  observer: 'app_observer_runs',
} as const;
export type EditorialEntity = keyof typeof ENTITY_TABLES;
/** Compact hints only: the owner row remains authoritative. Reads repair interrupted indexing.
 * No public/private payload is copied here and no cross-database transaction is claimed. */
export class EditorialDirectory {
  constructor(readonly router: MultiD1) {}
  async remember(kind: EditorialEntity, id: string, owner: DatabaseOwner) {
    if (!id || !EDITORIAL_OWNERS.includes(owner)) throw Error('Invalid editorial directory entry');
    const row = await this.router
      .shared()
      .statement(
        'INSERT INTO app_editorial_directory(kind,id,owner) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET owner=excluded.owner WHERE owner=excluded.owner RETURNING owner',
        [kind, id, owner],
      )
      .first();
    if (!row) throw Error('Global editorial ID owner conflict');
  }
  private async exists(kind: EditorialEntity, id: string, owner: DatabaseOwner) {
    // Discovery reads only compact identity metadata. The selected store still applies
    // its maintenance epoch fence before any payload read or mutation.
    const row = await this.router
      .monitoringBindings()
      [owner].prepare(
        `SELECT ${kind === 'source' ? 'id,team_id,league_wide' : 'id'} FROM ${ENTITY_TABLES[kind]} WHERE id=?`,
      )
      .bind(id)
      .first<any>();
    if (!row) return false;
    return (
      kind !== 'source' ||
      (row.league_wide || !row.team_id ? 'D1_SHARED' : teamDatabase(row.team_id)) === owner
    );
  }
  async resolve(kind: EditorialEntity, id: string): Promise<DatabaseOwner | null> {
    if (!Object.hasOwn(ENTITY_TABLES, kind) || !id || id.length > 300)
      throw Error('Invalid editorial identity');
    const table = ENTITY_TABLES[kind],
      shared = this.router.shared();
    const [hint] = await shared.rows<{ owner: DatabaseOwner }>(
      'SELECT owner FROM app_editorial_directory WHERE kind=? AND id=?',
      [kind, id],
    );
    if (hint) {
      if (!EDITORIAL_OWNERS.includes(hint.owner)) throw Error('Corrupt editorial owner');
      if (await this.exists(kind, id, hint.owner)) return hint.owner;
    }
    // Sequential probes stay below the platform's six simultaneous connection ceiling.
    let found: DatabaseOwner | null = null;
    for (const owner of EDITORIAL_OWNERS) {
      if (owner === hint?.owner) continue;
      if (await this.exists(kind, id, owner)) {
        if (found) throw Error('Duplicate global editorial identity');
        found = owner;
      }
    }
    if (found) await this.remember(kind, id, found);
    return found;
  }
  async storage(kind: EditorialEntity, id: string): Promise<Storage | null> {
    const owner = await this.resolve(kind, id);
    return owner ? this.router.storage(owner) : null;
  }
}
