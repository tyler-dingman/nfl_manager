import { fileURLToPath } from 'node:url';
import { validatePage } from './redirect-validation.mjs';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHmac, randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = process.cwd() + '/',
  host = 'down-distance-rc3-staging-web.tdingman5.workers.dev',
  base = 'https://' + host;
const dir = await readFile('/private/tmp/dd-rc3-private-location.txt', 'utf8'),
  credentials = JSON.parse(await readFile(dir + '/credentials.json', 'utf8'));
const records = [];
let asset;
async function find(dirpath) {
  for (const item of await readdir(dirpath, { withFileTypes: true })) {
    const p = dirpath + '/' + item.name;
    if (item.isFile() && item.name.endsWith('.js')) return p;
    if (item.isDirectory()) {
      const value = await find(p);
      if (value) return value;
    }
  }
}
asset = (await find(root + '.open-next/assets/_next/static')).slice(
  (root + '.open-next/assets').length,
);
async function check(label, path, options, expected) {
  const response = await fetch(base + path, { redirect: 'manual', ...options });
  const text = await response.text();
  records.push({
    label,
    path,
    status: response.status,
    expected,
    bytes: Buffer.byteLength(text),
    bodySha256: createHash('sha256').update(text).digest('hex'),
    cacheControl: response.headers.get('cache-control'),
  });
  await writeFile(
    root + 'reports/hosted-staging-rc3/completion/security.json',
    JSON.stringify(
      { url: base, checkedAtUtc: new Date().toISOString(), records, passed: false },
      null,
      2,
    ) + '\n',
  );
  if (response.status !== expected)
    throw Error(label + ': expected ' + expected + ', got ' + response.status);
  return response;
}
try {
  // workers.dev routing changes propagate asynchronously. A platform 404 is
  // denial, not a bypass; readiness requires the deployed gate's exact 403.
  let ready = false;
  for (let i = 0; i < 15; i++) {
    const r = await fetch(base + '/', { redirect: 'manual' });
    await r.text();
    if (r.status === 403) {
      ready = true;
      break;
    }
    if (r.status !== 404)
      throw Error('Unexpected anonymous exposure during readiness: ' + r.status);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  if (!ready) throw Error('Protected route not ready after bounded propagation wait');
  for (const [label, path] of [
    ['anonymous home', '/'],
    ['static JS', asset],
    ['favicon', '/favicon.ico'],
    ['API', '/api/auth/config'],
    ['authentication endpoint', '/api/auth/login'],
  ])
    await check(label, path, {}, 403);
  await check('invalid cookie', '/', { headers: { cookie: '__Host-dd_staging=invalid' } }, 403);
  await check(
    'spoofed header',
    '/api/auth/config',
    { headers: { 'Cf-Tls-Client-Auth': 'SUCCESS', authorization: 'Bearer invalid' } },
    403,
  );
  const issued = Math.floor(Date.now() / 1000) - 7200,
    expiry = issued + 3600,
    payload = `${issued}.${expiry}.${randomBytes(16).toString('base64url')}`;
  const expired =
    payload +
    '.' +
    createHmac('sha256', credentials.STAGING_ACCESS_SECRET)
      .update('staging-session|' + host + '|' + payload)
      .digest('base64url');
  await check(
    'expired signed cookie',
    '/',
    { headers: { cookie: '__Host-dd_staging=' + expired } },
    403,
  );
  await check('generic credential form', '/__staging/access', {}, 200);
  const post = (credential) => ({
    method: 'POST',
    headers: { origin: base, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ credential }),
  });
  await check(
    'invalid staging credential',
    '/__staging/access',
    post('invalid-staging-credential'),
    401,
  );
  const response = await check(
    'authorized credential',
    '/__staging/access',
    post(credentials.STAGING_ACCESS_SECRET),
    303,
  );
  const set = response.headers.get('set-cookie');
  if (
    !set ||
    !set.includes('HttpOnly') ||
    !set.includes('Secure') ||
    !set.includes('SameSite=Strict')
  )
    throw Error('Unsafe cookie attributes');
  const cookie = set.split(';')[0];
  await writeFile(dir + '/staging-cookie.txt', cookie, { mode: 0o600 });
  await check('authorized asset', asset, { headers: { cookie } }, 200);
  const expectedHash = createHash('sha256')
    .update(await readFile(root + '.open-next/assets' + asset))
    .digest('hex');
  if (records.at(-1).bodySha256 !== expectedHash)
    throw Error('Authorized asset content differs from deployed build');
  const page = await validatePage({
    base,
    path: '/',
    applicationAuthenticated: false,
    request: (url) => fetch(url, { redirect: 'manual', headers: { cookie } }),
  });
  records.push({ label: 'signed-out page and login render', ...page });
  await check('product session absent', '/api/auth/me', { headers: { cookie } }, 401);
  await check('authorized auth configuration', '/api/auth/config', { headers: { cookie } }, 200);
  for (const role of ['password', 'api', 'odds-processor', 'application']) {
    const url = `https://down-distance-rc3-staging-${role}.tdingman5.workers.dev/`;
    const r = await fetch(url, { redirect: 'manual' });
    const text = await r.text();
    records.push({
      label: 'internal ' + role + ' public URL',
      url,
      status: r.status,
      bytes: Buffer.byteLength(text),
    });
    if (r.status !== 404 && r.status !== 403)
      throw Error('Internal Worker public endpoint status ' + r.status);
  }
  await writeFile(
    root + 'reports/hosted-staging-rc3/completion/security.json',
    JSON.stringify(
      {
        url: base,
        checkedAtUtc: new Date().toISOString(),
        records,
        passed: true,
        credentialValuesRecorded: false,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'Hosted security PASS: anonymous/invalid/expired/assets/API/auth denied, valid cookie/asset/auth config allowed, internal public URLs denied.',
  );
} catch (error) {
  execFileSync(
    process.execPath,
    [fileURLToPath(new URL('./exposure.mjs', import.meta.url)), 'disable'],
    { stdio: 'inherit' },
  );
  await writeFile(
    root + 'reports/hosted-staging-rc3/completion/security-failure.json',
    JSON.stringify({ message: error.message, publicExposureDisabled: true, records }, null, 2) +
      '\n',
  );
  throw error;
}
