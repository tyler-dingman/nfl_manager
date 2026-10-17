import type { harness } from './harness';
import type { LeanEditorial } from '../src/lean-editorial';
/** Disposable local fixture only; verified terminal rows, never pending/running work. */
export async function handoffSyntheticJob(
  h: Awaited<ReturnType<typeof harness>>,
  store: LeanEditorial,
  id: string,
) {
  if (
    !h.directory.includes('/dd-editorial-synthetic-') ||
    !h.options.d1Databases.EDITORIAL_DB.startsWith('editorial-synthetic-')
  )
    throw Error('Synthetic handoff guard');
  const [row] = await h.db.query<any>(
    'lean.handoff.select',
    "SELECT * FROM ingestion_jobs WHERE id=? AND status IN ('DONE','DEAD')",
    [id],
    false,
  );
  if (!row) throw Error('Terminal job required');
  const payload = { ...row, payload_json: JSON.parse(await h.db.resolveJson!(row.payload_json)) };
  await store.receipt('job', row.id, row.idempotency_key, payload);
  if (JSON.stringify(await store.readReceipt('job', row.id)) !== JSON.stringify(payload))
    throw Error('Handoff verification failed');
  const token = crypto.randomUUID();
  await h.db.batch('lean.handoff.commit', [
    h.db.statement(
      'DELETE FROM ingestion_jobs WHERE id=? AND status=? AND updated_at=? AND payload_json=?',
      [row.id, row.status, row.updated_at, row.payload_json],
    ),
    h.db.guard(token),
    h.db.unguard(token),
  ]);
  return payload;
}
