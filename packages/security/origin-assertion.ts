/** Shared edge/Node protocol. Authenticates transport, never a user or session. */
export const ORIGIN_HEADER = 'x-dd-origin-assertion';
export type OriginConfiguration = { secret: string; audience: string; publicOrigin: string };
const encoder = new TextEncoder(),
  decoder = new TextDecoder('utf-8', { fatal: true });
const b64 = (b: Uint8Array) =>
  btoa(String.fromCharCode(...b))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
const unb64 = (s: string) =>
  Uint8Array.from(atob(s.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0));
const key = (secret: string) => {
  if (secret.length < 64) throw Error('Origin secret must contain at least 64 characters');
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
};
const digest = async (bytes: Uint8Array) =>
  b64(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource)));
export async function boundedRequestBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const parts: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 4000000) {
      await reader.cancel();
      throw Error('Origin body bound exceeded');
    }
    parts.push(value);
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const p of parts) {
    body.set(p, offset);
    offset += p.length;
  }
  return body;
}
export async function signOriginRequest(
  request: Request,
  configuration: OriginConfiguration,
  now = Math.floor(Date.now() / 1000),
) {
  const url = new URL(request.url);
  if (url.origin !== new URL(configuration.publicOrigin).origin || url.username || url.password)
    throw Error('Untrusted public origin');
  const body = await boundedRequestBody(request.clone()),
    headers: Record<string, string> = {};
  for (const [name, value] of request.headers)
    if (
      !/^(host$|connection$|transfer-encoding$|content-length$|accept-encoding$|cf-|x-forwarded-|x-real-ip$|x-dd-)/i.test(
        name,
      )
    )
      headers[name] = value;
  const payload = {
    v: 1,
    aud: configuration.audience,
    url: url.href,
    method: request.method,
    iat: now,
    exp: now + 20,
    nonce: b64(crypto.getRandomValues(new Uint8Array(24))),
    headers,
    body: await digest(body),
  };
  const raw = JSON.stringify(payload);
  if (encoder.encode(raw).length > 10000) throw Error('Origin header bound exceeded');
  const encoded = b64(encoder.encode(raw)),
    signature = b64(
      new Uint8Array(
        await crypto.subtle.sign('HMAC', await key(configuration.secret), encoder.encode(encoded)),
      ),
    );
  return { assertion: encoded + '.' + signature, body };
}
export async function verifyOriginRequest(
  request: Request,
  configuration: OriginConfiguration,
  claim: (nonce: string, expires: number) => Promise<void>,
  now = Math.floor(Date.now() / 1000),
) {
  const assertion = request.headers.get(ORIGIN_HEADER) ?? '';
  if (assertion.length > 16000 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(assertion))
    throw Error('Origin denied');
  const [encoded, signature] = assertion.split('.');
  if (
    !(await crypto.subtle.verify(
      'HMAC',
      await key(configuration.secret),
      unb64(signature),
      encoder.encode(encoded),
    ))
  )
    throw Error('Origin denied');
  const p = JSON.parse(decoder.decode(unb64(encoded))),
    url = new URL(p.url);
  if (
    p.v !== 1 ||
    p.aud !== configuration.audience ||
    url.origin !== new URL(configuration.publicOrigin).origin ||
    url.username ||
    url.password ||
    url.hash ||
    p.method !== request.method ||
    !Number.isInteger(p.iat) ||
    !Number.isInteger(p.exp) ||
    p.iat > now + 3 ||
    p.iat < now - 23 ||
    p.exp <= now ||
    p.exp - p.iat !== 20 ||
    !/^[A-Za-z0-9_-]{32}$/.test(p.nonce) ||
    !p.headers ||
    typeof p.headers !== 'object' ||
    Array.isArray(p.headers)
  )
    throw Error('Origin denied');
  const headers = new Headers();
  for (const [name, value] of Object.entries(p.headers)) {
    if (
      typeof value !== 'string' ||
      /^(host$|connection$|transfer-encoding$|content-length$|cf-|x-forwarded-|x-real-ip$|x-dd-)/i.test(
        name,
      )
    )
      throw Error('Origin denied');
    headers.set(name, value);
  }
  const body = await boundedRequestBody(request);
  if (p.body !== (await digest(body))) throw Error('Origin denied');
  // Verify the actual path too; origin host is reconstructed solely from signed data.
  const actual = new URL(request.url);
  if (actual.pathname + actual.search !== url.pathname + url.search) throw Error('Origin denied');
  await claim(p.nonce, p.exp);
  return new Request(url, {
    method: p.method,
    headers,
    ...(!['GET', 'HEAD'].includes(p.method) ? { body: body as BodyInit } : {}),
    redirect: 'manual',
  });
}
