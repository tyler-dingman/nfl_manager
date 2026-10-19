import { MultiD1, type DatabaseOwner, teamDatabase } from './multi-d1';
import { D1EditorialIngestion } from './editorial-ingestion';
import type { ContentCandidate, RegisteredSource } from '../../src/features/story-engine/types';
export async function stageEditorialHandoff(
  router: MultiD1,
  owner: DatabaseOwner,
  candidate: ContentCandidate,
  source: RegisteredSource,
) {
  const target = candidate.candidateTeams[0]
    ? teamDatabase(candidate.candidateTeams[0])
    : 'D1_SHARED';
  if (target === owner) return false;
  const s = router.storage(owner);
  const prior = await s.rows(
    'SELECT id FROM app_editorial_handoffs WHERE source_id=? AND external_id=?',
    [source.id, candidate.externalId],
  );
  if (prior.length) return true;
  const id = candidate.id ?? crypto.randomUUID(),
    hash = await s.put({ schema: 1, id, candidate: { ...candidate, id }, source });
  await s
    .statement(
      "INSERT INTO app_editorial_handoffs(id,source_id,external_id,canonical_url,target,object_hash,status) VALUES(?,?,?,?,?,?,'READY') ON CONFLICT(source_id,external_id) DO NOTHING",
      [id, source.id, candidate.externalId, candidate.url, target, hash],
    )
    .run();
  return true;
}
/** Each phase is one invocation. Raw evidence remains pinned by the source outbox until
 * destination candidate + durable job are verified. Replays are idempotent across crashes. */
export async function advanceEditorialHandoff(router: MultiD1, owner: DatabaseOwner) {
  const s = router.storage(owner),
    [row] = await s.rows<any>(
      "SELECT * FROM app_editorial_handoffs WHERE status<>'DONE' ORDER BY id LIMIT 1",
    );
  if (!row) return { done: true };
  const envelope = await s.get<any>(row.object_hash);
  if (
    envelope.schema !== 1 ||
    envelope.id !== row.id ||
    envelope.candidate.sourceId !== row.source_id ||
    !/^D1_(TEAM_[1-8]|SHARED)$/.test(row.target)
  )
    throw Error('Invalid editorial handoff identity');
  const destination = router.storage(row.target),
    repo = new D1EditorialIngestion(destination);
  if (row.status === 'READY') {
    await repo.syncSource({
      ...envelope.source,
      enabled: false,
      metadata: { ...envelope.source.metadata, replicaOf: owner },
    });
    await s
      .statement(
        "UPDATE app_editorial_handoffs SET status='SOURCE_READY' WHERE id=? AND status='READY'",
        [row.id],
      )
      .run();
  } else if (row.status === 'SOURCE_READY') {
    await repo.saveCandidate(envelope.candidate);
    const [candidate] = await destination.rows<{ id: string }>(
      'SELECT id FROM app_editorial_candidates WHERE (source_id=? AND external_id=?) OR canonical_url=?',
      [row.source_id, row.external_id, envelope.candidate.url],
    );
    if (!candidate) {
      const [receipt] = await destination.rows(
        'SELECT id FROM app_storage_candidate_receipts WHERE canonical_url=?',
        [envelope.candidate.url],
      );
      if (!receipt) throw Error('Destination candidate not verified');
      // A verified processed-candidate receipt must not resurrect expired work.
      // Retain this distinct source envelope as attribution/recovery evidence.
      await s
        .statement(
          "UPDATE app_editorial_handoffs SET status='DONE' WHERE id=? AND status='SOURCE_READY'",
          [row.id],
        )
        .run();
      return { done: false };
    }
    const exact = await repo.candidateById(candidate.id);
    if (!exact || exact.url !== envelope.candidate.url)
      throw Error('Destination candidate mismatch');
    await s
      .statement(
        "UPDATE app_editorial_handoffs SET status='CANDIDATE_READY',candidate_id=? WHERE id=? AND status='SOURCE_READY'",
        [candidate.id, row.id],
      )
      .run();
  } else if (row.status === 'CANDIDATE_READY') {
    await repo.enqueueJob('CANDIDATE_PROCESS', `candidate:${row.candidate_id}`, {
      candidateId: row.candidate_id,
    });
    const [job] = await destination.rows(
      'SELECT id FROM app_editorial_jobs WHERE idempotency_key=?',
      [`candidate:${row.candidate_id}`],
    );
    if (!job) throw Error('Destination job not verified');
    await s
      .statement(
        "UPDATE app_editorial_handoffs SET status='DONE',object_hash=CASE WHEN candidate_id=id THEN NULL ELSE object_hash END WHERE id=? AND status='CANDIDATE_READY'",
        [row.id],
      )
      .run();
  } else throw Error('Unknown handoff phase');
  return { done: false };
}
