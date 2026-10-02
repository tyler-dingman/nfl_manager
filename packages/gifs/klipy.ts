import { gifReference, klipyMediaUrl, type GifItem, type GifProvider, type GifPage } from './index';
export function normalizeKlipy(item: any): GifItem {
  if (item?.type === 'ad') throw Error('This KLIPY key needs an ad-free GIF configuration.');
  const id = gifReference({
    mediaType: 'gif',
    provider: 'klipy',
    providerMediaId: item?.slug,
  }).providerMediaId;
  const file = item.file;
  const media = file?.sm?.gif ?? file?.xs?.gif;
  const preview = file?.xs?.gif ?? media;
  const still = file?.sm?.jpg ?? file?.xs?.jpg;
  if (
    !media ||
    !still ||
    !Number.isFinite(media.width) ||
    !Number.isFinite(media.height) ||
    media.width <= 0 ||
    media.height <= 0 ||
    media.width > 4096 ||
    media.height > 4096
  )
    throw Error('Unsupported GIF response.');
  const title = typeof item.title === 'string' ? item.title.slice(0, 240) : 'GIF';
  const source =
    typeof item.source === 'string'
      ? item.source
      : typeof item.username === 'string'
        ? item.username
        : '';
  return {
    id,
    provider: 'klipy',
    title,
    previewUrl: klipyMediaUrl(preview.url),
    stillUrl: klipyMediaUrl(still.url),
    mediaUrl: klipyMediaUrl(media.url),
    width: media.width,
    height: media.height,
    aspectRatio: media.width / media.height,
    providerUrl: `https://klipy.com/gifs/${encodeURIComponent(id)}`,
    attribution: source ? `KLIPY · ${source.slice(0, 160)}` : 'Powered by KLIPY',
  };
}
/** Standard KLIPY integrations originate on the end-user client, never a D&D proxy. */
export function createKlipyProvider(
  appKey: string | undefined,
  request: typeof fetch = fetch,
): GifProvider {
  const call = async (
    path: string,
    params: Record<string, string>,
    signal?: AbortSignal,
    method = 'GET',
  ) => {
    if (!appKey)
      throw Error('GIF search is not configured yet. Add the KLIPY public app key to enable it.');
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timeout = setTimeout(abort, 8000);
    try {
      const url = `https://api.klipy.com/api/v1/${encodeURIComponent(appKey)}/gifs/${path}`;
      const res = await request(method === 'GET' ? `${url}?${new URLSearchParams(params)}` : url, {
        method,
        signal: controller.signal,
        cache: 'no-store',
        ...(method === 'POST'
          ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) }
          : {}),
      });
      if (res.status === 429) throw Error('GIF search is busy. Please try again shortly.');
      if (!res.ok) throw Error("Couldn't load GIFs. Try again.");
      const body = await res.json();
      if (!body.result) throw Error("Couldn't load GIFs. Try again.");
      return body.data;
    } catch (e) {
      if (signal?.aborted) throw e;
      if (e instanceof Error && e.name === 'AbortError')
        throw Error('GIF search timed out. Try again.');
      // Never surface request URLs (which contain the public app key).
      if (e instanceof TypeError) throw Error("Couldn't load GIFs. Try again.");
      throw e;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  };
  const page = async (q: string, cursor = '1', signal?: AbortSignal): Promise<GifPage> => {
    if (!/^[1-9]\d{0,3}$/.test(cursor)) throw Error('Invalid GIF page.');
    const result = await call(
      q ? 'search' : 'trending',
      {
        page: cursor,
        per_page: '20',
        locale: 'us',
        format_filter: 'gif,jpg',
        content_filter: 'high',
        ...(q ? { q: q.slice(0, 120) } : {}),
      },
      signal,
    );
    if (!Array.isArray(result?.data)) throw Error('Unsupported GIF response.');
    // Preserve ordering/composition; do not silently filter unsupported provider entries.
    return {
      items: result.data.map(normalizeKlipy),
      cursor: result.has_next ? String(Number(cursor) + 1) : undefined,
    };
  };
  return {
    search: page,
    trending: (cursor, signal) => page('', cursor, signal),
    async getById(id, signal) {
      gifReference({ mediaType: 'gif', provider: 'klipy', providerMediaId: id });
      const result = await call('items', { slugs: id }, signal);
      const item = result?.data?.find((v: any) => v.slug === id);
      return item ? normalizeKlipy(item) : null;
    },
    async share(id, q = '') {
      gifReference({ mediaType: 'gif', provider: 'klipy', providerMediaId: id });
      await call(`share/${encodeURIComponent(id)}`, q ? { q } : {}, undefined, 'POST');
    },
  };
}
