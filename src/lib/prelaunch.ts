export const PREVIEW_COOKIE = 'dnd_preview_access';
export const PREVIEW_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function signature(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return base64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}

function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1)
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  return difference === 0;
}

export function prelaunchEnabled() {
  return process.env.PRELAUNCH_MODE === 'true';
}

function sessionSecret() {
  return process.env.PRELAUNCH_SESSION_SECRET || process.env.PRELAUNCH_PASSWORD || '';
}

export async function issuePreviewToken(now = Date.now()) {
  const expiresAt = now + PREVIEW_MAX_AGE_SECONDS * 1000;
  const payload = String(expiresAt);
  return `${payload}.${await signature(payload, sessionSecret())}`;
}

export async function verifyPreviewToken(token?: string, now = Date.now()) {
  if (!token || !sessionSecret()) return false;
  const [expiresAt, provided, extra] = token.split('.');
  if (!expiresAt || !provided || extra || Number(expiresAt) <= now) return false;
  return constantTimeEqual(provided, await signature(expiresAt, sessionSecret()));
}
