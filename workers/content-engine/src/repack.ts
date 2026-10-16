import { EditorialDatabase, integer } from './database';
import { PayloadStore } from './payloads';
// Fixed identifiers only. Existing IDs, revision numbers and content hashes stay intact.
const targets = {
  canonical_stories: ['id', 'record_json'],
  content_candidates: ['id', 'record_json'],
  content_candidate_revisions: ['candidate_id', 'record_json', 'revision'],
  story_versions: ['story_id', 'record_json', 'version'],
  editorial_cards: ['id', 'descriptor_json'],
  film_room_videos: ['video_id', 'record_json'],
  three_and_out_snapshots: ['id', 'record_json'],
} as const;
export async function repackRow(
  db: EditorialDatabase,
  table: keyof typeof targets,
  id: string,
  version?: number,
) {
  const target = targets[table];
  if (!target) throw Error('Invalid repack table');
  const [key, column, revision] = target as readonly string[];
  if (revision) integer(version!);
  const values = revision ? [id, version!] : [id];
  const where = `${key}=?${revision ? ` AND ${revision}=?` : ''}`;
  // Raw physical JSON is required for compare-and-swap; expanded query values are unsuitable.
  const row = await db.binding
    .prepare(`SELECT ${column} AS value FROM ${table} WHERE ${where}`)
    .bind(...values)
    .first<{ value: string }>();
  if (!row) return false;
  const payloads = new PayloadStore(db),
    value = await payloads.read(row.value),
    stored = await payloads.store(value);
  if (stored === row.value) return false;
  if (JSON.stringify(await payloads.read(stored)) !== JSON.stringify(value))
    throw Error('Repack verification failed');
  const token = crypto.randomUUID();
  await db.batch('payload.repack', [
    db.statement(`UPDATE ${table} SET ${column}=? WHERE ${where} AND ${column}=?`, [
      stored,
      ...values,
      row.value,
    ]),
    db.guard(token),
    db.unguard(token),
  ]);
  return true;
}
