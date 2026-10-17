import { LeanEditorial, editorialDocumentHash, type EditorialDocument } from './lean-editorial';
/** Offline staged import only. Existing repository remains authoritative until separately reviewed cutover. */
export async function importEditorial(store: LeanEditorial, documents: EditorialDocument[]) {
  const seen = new Set<string>();
  for (const document of documents) {
    const key = JSON.stringify([document.kind, document.id]);
    if (seen.has(key)) throw Error('Duplicate import identity');
    seen.add(key);
  }
  let changed = 0;
  for (const document of documents) {
    if ((await store.put(document)).changed) changed++;
    const restored = await store.get(document.kind, document.id);
    if (JSON.stringify(restored?.payload) !== JSON.stringify(document.payload))
      throw Error('Import round-trip mismatch');
  }
  return { verified: documents.length, changed };
}
export async function rollbackExport(
  store: LeanEditorial,
  identities: { kind: string; id: string }[],
) {
  const documents: EditorialDocument[] = [];
  for (const identity of identities) {
    const value = await store.get(identity.kind, identity.id);
    if (!value) throw Error('Missing rollback identity');
    documents.push(value);
  }
  return documents;
}
/** Original kind/ID/revision are retained. Preflight gaps before any writes; interrupted imports resume. */
export async function importEditorialHistory(
  store: LeanEditorial,
  records: { revision: number; document: EditorialDocument }[],
) {
  const groups = new Map<string, { revision: number; document: EditorialDocument }[]>();
  for (const record of records) {
    const key = JSON.stringify([record.document.kind, record.document.id]);
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.revision - b.revision);
    for (const [i, record] of group.entries())
      if (record.revision !== i + 1)
        throw Error('Import history must contain contiguous original revisions');
  }
  let changed = 0,
    verified = 0;
  for (const group of groups.values())
    for (const record of group) {
      const existing = await store.get(record.document.kind, record.document.id, record.revision);
      if (existing) {
        if (
          (await editorialDocumentHash(existing)) !==
          (await editorialDocumentHash({
            ...record.document,
            teamIds: [...new Set(record.document.teamIds)].sort(),
          }))
        )
          throw Error('Existing history conflict');
      } else {
        const result = await store.put(record.document);
        if (result.revision !== record.revision) throw Error('Original revision mismatch');
        if (result.changed) changed++;
      }
      verified++;
    }
  return { verified, changed };
}
export async function exportEditorialHistory(
  store: LeanEditorial,
  identities: { kind: string; id: string }[],
) {
  if (store.strategy === 'C') throw Error('Indexed history export requires A or B');
  const records: { revision: number; document: EditorialDocument }[] = [];
  for (const identity of identities) {
    const rows = await store.db.query<{ revision: number }>(
      'lean.migration.history',
      'SELECT revision FROM lean_versions WHERE strategy=? AND kind=? AND id=? ORDER BY revision',
      [store.strategy, identity.kind, identity.id],
      false,
    );
    if (!rows.length) throw Error('Missing rollback identity');
    for (const row of rows) {
      const document = await store.get(identity.kind, identity.id, row.revision);
      if (!document) throw Error('Missing rollback version');
      records.push({ revision: row.revision, document });
    }
  }
  return records;
}
