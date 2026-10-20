import { getCloudflareContext } from '@opennextjs/cloudflare/cloudflare-context';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/server/auth/http';

type SessionService = { fetch(request: Request): Promise<Response> };

/** Use the request-scoped OpenNext binding, never a public Worker self-fetch.
 * Non-Cloudflare Next deployments retain their existing same-origin HTTP lookup. */
function sessionService(): SessionService | undefined {
  let context;
  try {
    context = getCloudflareContext();
  } catch {
    if (process.env.APP_RUNTIME === 'cloudflare')
      throw new Error('Cloudflare session context is unavailable');
    return undefined;
  }
  const service = (context.env as { API_SERVICE?: SessionService }).API_SERVICE;
  if (!service || typeof service.fetch !== 'function')
    throw new Error('Cloudflare session service is unavailable');
  return service;
}

async function resolveApplicationSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const service = sessionService();
  const url = new URL('/api/auth/me', request.url);
  const options: RequestInit = {
    method: 'GET',
    // This endpoint needs only the opaque product session, not the staging
    // credential, other cookies, caller-supplied bearer tokens or identity headers.
    headers: { cookie: `${SESSION_COOKIE}=${token}`, accept: 'application/json' },
    cache: 'no-store',
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
  };
  const response = service
    ? await service.fetch(new Request(url, options))
    : await fetch(url, options);
  if (response.status === 401) return false;
  if (response.status !== 200) throw new Error('Session lookup failed');
  const body = await response.json();
  // API validates token hash, expiry, revocation and user status on every lookup.
  return body.ok === true && typeof body.user?.id === 'string' && body.user.id.length > 0;
}

/** Numeric SSR transport timing only; API signature/lookup CPU is a separate Worker event. */
export async function hasApplicationSession(request: NextRequest): Promise<boolean> {
  let timed = false;
  try {
    timed =
      (getCloudflareContext().env as { APP_AUTH_TIMINGS?: string }).APP_AUTH_TIMINGS === 'true';
  } catch {}
  if (!timed) return resolveApplicationSession(request);
  const start = performance.now();
  let ok = false;
  try {
    const result = await resolveApplicationSession(request);
    ok = true;
    return result;
  } finally {
    console.log(
      JSON.stringify({
        metric: 'auth_stage',
        stage: 'ssr.authentication',
        elapsedMs: performance.now() - start,
        ok,
        cpuMs: null,
      }),
    );
  }
}
