import { EditorialDatabase, integer, json, text } from './database';
import type { RecordData } from './types';
export async function recordRun(
  db: EditorialDatabase,
  input: { id: string; kind: string; occurredAt: number; metrics: RecordData },
) {
  text(input.id);
  text(input.kind);
  integer(input.occurredAt);
  await db.batch('run.record', [
    db.statement('INSERT INTO content_run_log(id,kind,occurred_at,record_json) VALUES(?,?,?,?)', [
      input.id,
      input.kind,
      input.occurredAt,
      json(input.metrics),
    ]),
  ]);
}
