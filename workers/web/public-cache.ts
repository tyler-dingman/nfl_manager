/** Explicit public route only. Authenticated requests and user-specific responses
 * can never enter this cache. Odds retain stored as-of/coverage fields. */
export function publicCacheKey(request: Request, version: string) {
  const url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    request.headers.has('authorization') ||
    request.headers.has('cookie') ||
    url.pathname !== '/api/parlay-lab/events' ||
    url.search ||
    !version
  )
    return null;
  url.searchParams.set('__publication_cache_version', version);
  return new Request(url.toString(), { method: 'GET' });
}
export async function cachePublicResponse(
  cache: Pick<Cache, 'put'>,
  key: Request,
  response: Response,
) {
  if (
    response.status !== 200 ||
    response.headers.has('set-cookie') ||
    /private|no-store/i.test(response.headers.get('cache-control') ?? '') ||
    response.headers.get('vary') === '*'
  )
    return false;
  const cached = new Response(response.clone().body, response);
  cached.headers.set('Cache-Control', 'public, max-age=30');
  await cache.put(key, cached);
  return true;
}
