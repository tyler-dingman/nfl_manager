import { publicContentPath } from '../../packages/public-content-policy';
/** Explicit public route only. Authenticated requests and user-specific responses
 * can never enter this cache. Odds retain stored as-of/coverage fields. */
export function publicCacheKey(request: Request, version: string) {
  const url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    request.headers.has('authorization') ||
    request.headers.has('cookie') ||
    !publicContentPath(url.pathname + url.search) ||
    !version
  )
    return null;
  const canonical = new URL(publicContentPath(url.pathname + url.search)!, url.origin);
  canonical.searchParams.set('__publication_cache_version', version);
  url.href = canonical.href;
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
    Boolean(
      response.headers.get('vary') && !/^accept-encoding$/i.test(response.headers.get('vary')!),
    )
  )
    return false;
  const cached = new Response(response.clone().body, response);
  const maxAge = Math.min(
    30,
    Number(/(?:^|,)\s*max-age=(\d+)/i.exec(response.headers.get('cache-control') ?? '')?.[1] ?? 30),
  );
  if (maxAge < 1) return false;
  cached.headers.set('Cache-Control', `public, max-age=${maxAge}`);
  await cache.put(key, cached);
  return true;
}
