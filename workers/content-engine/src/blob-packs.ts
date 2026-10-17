import { EditorialDatabase } from './database';
import { sha, type PrivateArchiveObjects } from './r2-archive';

/** Opt-in local experiment. Never imported by Worker entry points. No removal API. */
export class BlobPacks {
  constructor(
    readonly db: EditorialDatabase,
    readonly objects: PrivateArchiveObjects,
  ) {
    db.resolveBlob = (hash) => this.read(hash);
  }
  async read(hash: string): Promise<Uint8Array | null> {
    const [location] = await this.db.query<any>(
      'blob.pack.location',
      'SELECT p.pack_hash,b.byte_offset,b.encoded_length FROM editorial_blobs b JOIN editorial_blob_packs p ON p.id=b.pack_id WHERE b.hash=?',
      [hash],
      false,
    );
    if (!location) return null;
    const bytes = await this.objects.get(`editorial/blobs/v1/${location.pack_hash}`);
    if (!bytes || (await sha(bytes)) !== location.pack_hash)
      throw Error('Blob pack checksum failed');
    const { byte_offset: offset, encoded_length: length } = location;
    if (
      !Number.isSafeInteger(offset) ||
      !Number.isSafeInteger(length) ||
      offset < 0 ||
      length < 1 ||
      offset + length > bytes.length
    )
      throw Error('Invalid blob pack range');
    // PayloadStore additionally verifies original uncompressed content hash and length.
    return bytes.slice(offset, offset + length);
  }
  async copyBatch(limit = 32, maxBytes = 128000) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 32 || maxBytes < 4096 || maxBytes > 256000)
      throw Error('Invalid blob pack budget');
    const rows = await this.db.query<any>(
      'blob.pack.select',
      'SELECT b.* FROM editorial_blobs b WHERE b.pack_id IS NULL ORDER BY b.hash LIMIT ?',
      [limit],
      false,
    );
    const members: { hash: string; offset: number; bytes: Uint8Array }[] = [];
    let length = 0;
    for (const row of rows) {
      let bytes = new Uint8Array(row.body);
      if (row.fragment_count) {
        const parts = await this.db.query<any>(
          'blob.pack.fragments',
          'SELECT part,body FROM editorial_blob_fragments WHERE hash=? ORDER BY part',
          [row.hash],
          false,
        );
        if (parts.length !== row.fragment_count || parts.some((p, i) => p.part !== i))
          throw Error('Missing blob fragments');
        const buffers = parts.map((p) => new Uint8Array(p.body));
        bytes = new Uint8Array(buffers.reduce((n, b) => n + b.length, 0));
        let at = 0;
        for (const buffer of buffers) {
          bytes.set(buffer, at);
          at += buffer.length;
        }
      }
      if (!bytes.length || bytes.length > maxBytes)
        throw Error('Blob exceeds pack budget; originals retained');
      if (length + bytes.length > maxBytes) break;
      members.push({ hash: row.hash, offset: length, bytes });
      length += bytes.length;
    }
    if (!members.length) return 0;
    const pack = new Uint8Array(length);
    for (const member of members) pack.set(member.bytes, member.offset);
    const digest = await sha(pack),
      key = `editorial/blobs/v1/${digest}`;
    await this.objects.putImmutable(key, pack);
    const verified = await this.objects.get(key);
    if (!verified || (await sha(verified)) !== digest) throw Error('Blob pack verification failed');
    await this.db.batch('blob.pack.activate', [
      this.db.statement(
        'INSERT INTO editorial_blob_packs(pack_hash) VALUES(?) ON CONFLICT(pack_hash) DO NOTHING',
        [digest],
      ),
      ...members.map((m) =>
        this.db.statement(
          'UPDATE editorial_blobs SET pack_id=(SELECT id FROM editorial_blob_packs WHERE pack_hash=?),byte_offset=?,encoded_length=? WHERE hash=? AND pack_id IS NULL',
          [digest, m.offset, m.bytes.length, m.hash],
        ),
      ),
    ]);
    return members.length;
  }
}
