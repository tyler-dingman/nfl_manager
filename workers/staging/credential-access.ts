import type { SqlDatabase } from '../../packages/storage/core';

const COOKIE = '__Host-dd_staging';
const SESSION_SECONDS = 3600;
const encoder = new TextEncoder();
type Env = {
  STAGING_ACCESS_SECRET?: string;
  STAGING_ACCESS_HOST?: string;
  STAGING_ACCESS_EXPIRES_AT?: string;
  D1_USERS?: SqlDatabase;
};
const encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
const decode = (text: string) =>
  Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0));
const headers = {
  'Cache-Control': 'private, no-store',
  'Content-Type': 'text/html; charset=utf-8',
  'Content-Security-Policy':
    "default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  // Preserve the Origin on same-origin HTML form POSTs. no-referrer makes
  // browsers send Origin:null, which the strict CSRF check correctly rejects.
  'Referrer-Policy': 'same-origin',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};
const reply = (status: number, text = 'Private staging access required') =>
  new Response(text, { status, headers });
async function key(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}
async function sign(k: CryptoKey, text: string) {
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, encoder.encode(text)));
}
async function boundedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return '';
  let body = '',
    bytes = 0;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  for (;;) {
    const part = await reader.read();
    if (part.done) return body + decoder.decode();
    bytes += part.value.byteLength;
    if (bytes > 512) {
      await reader.cancel();
      throw Error('body bound');
    }
    body += decoder.decode(part.value, { stream: true });
  }
}
/** D1-backed fixed-key counters. At most 100 credential submissions/day, 12/min
 * globally and 4/min per hashed IP bucket. At most 258 fixed keys, no raw IPs.
 * Daily reservation comes first: abusive traffic cannot cause unbounded writes.
 * Valid session requests use no D1 queries. Failure always denies access. */
async function reserve(db: SqlDatabase, k: CryptoKey, ip: string, now: number) {
  const bucket = (await sign(k, 'staging-ip|' + ip))[0].toString(16).padStart(2, '0');
  for (const [id, window, limit] of [
    ['daily', Math.floor(now / 86400000), 100],
    ['minute', Math.floor(now / 60000), 12],
    ['ip:' + bucket, Math.floor(now / 60000), 4],
  ] as const) {
    const result = await db
      .prepare(
        `INSERT INTO app_storage_staging_access(key,window,attempts) VALUES(?,?,1)
      ON CONFLICT(key) DO UPDATE SET window=excluded.window,
      attempts=CASE WHEN app_storage_staging_access.window=excluded.window THEN app_storage_staging_access.attempts+1 ELSE 1 END
      WHERE app_storage_staging_access.window<>excluded.window OR app_storage_staging_access.attempts<? RETURNING attempts`,
      )
      .bind(id, window, limit)
      .first();
    if (!result) return false;
  }
  return true;
}
/** All app pages, assets and APIs pass through this gate before dispatch. Only
 * a generic credential form is public. No credentials in URLs, logs or JS.
 * Isolated secrets + host-bound one-hour HttpOnly signed cookies; global expiry
 * and secret rotation revoke all access. This does not depend on edge mTLS. */
export function stagingAccessGate(
  downstream: { fetch(request: Request, env: any, ctx: any): Promise<Response> },
  clock = () => Date.now(),
) {
  return {
    async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
      try {
        const url = new URL(request.url),
          now = clock(),
          end = Date.parse(env.STAGING_ACCESS_EXPIRES_AT ?? '');
        const secret = env.STAGING_ACCESS_SECRET ?? '',
          host = env.STAGING_ACCESS_HOST ?? '';
        if (
          !/^[A-Za-z0-9_-]{43,128}$/.test(secret) ||
          !host.endsWith('.workers.dev') ||
          url.protocol !== 'https:' ||
          url.hostname !== host ||
          !Number.isFinite(end) ||
          end <= now ||
          !env.D1_USERS
        )
          return reply(503, 'Private staging is unavailable');
        const k = await key(secret);
        if (url.pathname === '/__staging/access') {
          if (url.search) return reply(400);
          if (request.method === 'GET')
            return reply(
              200,
              '<!doctype html><html><head><title>Private staging</title></head><body><h1>Private staging</h1><form method="post" action="/__staging/access"><label>Staging credential <input name="credential" type="password" autocomplete="off" required maxlength="128"></label><button type="submit">Enter staging</button></form></body></html>',
            );
          if (
            request.method !== 'POST' ||
            request.headers.get('origin') !== url.origin ||
            !request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')
          )
            return reply(403);
          const ip = request.headers.get('cf-connecting-ip');
          if (!ip) return reply(503);
          if (!(await reserve(env.D1_USERS, k, ip, now)))
            return new Response('Staging sign-in rate limit', {
              status: 429,
              headers: { ...headers, 'Retry-After': '60' },
            });
          const fields = new URLSearchParams(await boundedBody(request));
          const values = fields.getAll('credential');
          if (
            values.length !== 1 ||
            !(await crypto.subtle.verify(
              'HMAC',
              k,
              await sign(k, 'staging-credential|' + secret),
              encoder.encode('staging-credential|' + values[0]),
            ))
          )
            return reply(401);
          const issued = Math.floor(now / 1000),
            expires = Math.min(issued + SESSION_SECONDS, Math.floor(end / 1000));
          const nonce = encode(crypto.getRandomValues(new Uint8Array(16)));
          const payload = `${issued}.${expires}.${nonce}`;
          const token =
            payload + '.' + encode(await sign(k, 'staging-session|' + host + '|' + payload));
          return new Response(null, {
            status: 303,
            headers: {
              ...headers,
              Location: '/',
              'Set-Cookie': `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${expires - issued}`,
            },
          });
        }
        const values = (request.headers.get('cookie') ?? '')
          .split(';')
          .map((x) => x.trim())
          .filter((x) => x.startsWith(COOKIE + '='));
        if (values.length !== 1) return reply(403);
        const token = values[0].slice(COOKIE.length + 1);
        const match = token.match(/^(\d{10})\.(\d{10})\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/);
        if (!match) return reply(403);
        const issued = Number(match[1]),
          expires = Number(match[2]),
          seconds = Math.floor(now / 1000);
        if (
          issued > seconds + 30 ||
          expires <= seconds ||
          expires - issued > SESSION_SECONDS ||
          expires <= issued ||
          expires > Math.floor(end / 1000)
        )
          return reply(403);
        const payload = token.slice(0, token.lastIndexOf('.'));
        if (
          !(await crypto.subtle.verify(
            'HMAC',
            k,
            decode(match[4]),
            encoder.encode('staging-session|' + host + '|' + payload),
          ))
        )
          return reply(403);
        const result = await downstream.fetch(request, env, ctx);
        const response = new Response(result.body, result);
        response.headers.set('Cache-Control', 'private, no-store');
        response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
        return response;
      } catch {
        return reply(503, 'Private staging is unavailable');
      }
    },
  };
}
