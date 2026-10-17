/** Cache policy experiment only; existing authenticated application routes are unchanged. */
const allowed = new Set(['/api/content/homepage', '/api/content/wire']);
export function publicEditorialCacheKey(request: Request): string | null {
  const url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    request.headers.has('authorization') ||
    request.headers.has('cookie') ||
    !allowed.has(url.pathname)
  )
    return null;
  const permitted = new Set(['team', 'category', 'sort', 'cursor', 'limit']);
  for (const key of url.searchParams.keys()) if (!permitted.has(key)) return null;
  url.searchParams.sort();
  return url.toString();
}
export function canStoreEditorialResponse(response: Response) {
  const control = response.headers.get('cache-control') ?? '';
  return (
    response.status === 200 &&
    !response.headers.has('set-cookie') &&
    !/private|no-store/i.test(control) &&
    !/\*/.test(response.headers.get('vary') ?? '') &&
    /public/i.test(control)
  );
}
