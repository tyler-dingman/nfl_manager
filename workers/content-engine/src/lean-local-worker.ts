import { EditorialDatabase } from './database';
import { LeanEditorial, LeanR2Objects, type EditorialDocument } from './lean-editorial';
import { MirroredEditorialObjects } from './mirrored-editorial';
interface LocalEnv {
  CONTENT_ENV: string;
  LOCAL_INGEST_TOKEN: string;
  EDITORIAL_DB: D1Database;
  EDITORIAL_ARCHIVE: R2Bucket;
  EDITORIAL_BACKUP: R2Bucket;
}
const kinds = new Set(['story', 'candidate', 'evidence', 'source', 'edition', 'video']);
/** Authenticated loopback-only runtime rehearsal. Never replaces existing public APIs. */
export default {
  async fetch(request: Request, env: LocalEnv): Promise<Response> {
    const url = new URL(request.url);
    if (env.CONTENT_ENV !== 'local' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
      return new Response('Local rehearsal only', { status: 403 });
    if (
      !env.LOCAL_INGEST_TOKEN ||
      request.headers.get('authorization') !== `Bearer ${env.LOCAL_INGEST_TOKEN}`
    )
      return new Response('Unauthorized', { status: 401 });
    try {
      const store = new LeanEditorial(
        new EditorialDatabase(env.EDITORIAL_DB),
        new MirroredEditorialObjects(
          new LeanR2Objects(env.EDITORIAL_ARCHIVE),
          new LeanR2Objects(env.EDITORIAL_BACKUP),
        ),
        'A',
      );
      const kind = url.searchParams.get('kind') ?? 'story';
      if (!kinds.has(kind)) return new Response('Editorial kinds only', { status: 400 });
      if (url.pathname === '/local/document' && request.method === 'POST') {
        const raw = await request.text();
        if (new TextEncoder().encode(raw).length > 600000)
          return new Response('Payload too large', { status: 413 });
        const document = JSON.parse(raw) as EditorialDocument;
        if (!kinds.has(document.kind)) return new Response('Editorial kinds only', { status: 400 });
        return Response.json(await store.put(document), {
          headers: { 'cache-control': 'no-store' },
        });
      }
      if (url.pathname === '/local/document' && request.method === 'GET') {
        const revision = url.searchParams.has('revision')
          ? Number(url.searchParams.get('revision'))
          : undefined;
        const value = await store.get(kind, url.searchParams.get('id') ?? '', revision);
        return value
          ? Response.json(value.payload, { headers: { 'cache-control': 'no-store' } })
          : new Response('Not found', { status: 404 });
      }
      if (url.pathname === '/local/feed' && request.method === 'GET')
        return Response.json(await store.fullFeed(url.searchParams.get('team') ?? '', kind), {
          headers: { 'cache-control': 'no-store' },
        });
      return new Response('Not found', { status: 404 });
    } catch {
      return new Response(
        'Local editorial operation failed; original source remains authoritative',
        { status: 503, headers: { 'cache-control': 'no-store' } },
      );
    }
  },
} satisfies ExportedHandler<LocalEnv>;
