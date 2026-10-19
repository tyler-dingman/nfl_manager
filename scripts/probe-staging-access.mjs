import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { publicKey, privateKey } = await generateKeyPair('RS256');
const jwk = await exportJWK(publicKey),
  domain = 'synthetic.cloudflareaccess.com',
  aud = 'a'.repeat(64);
const bundle = await build({
  stdin: {
    contents: `import {accessGate} from './workers/staging/access'; export default accessGate({fetch: async r => new Response(new URL(r.url).pathname)});`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
});
const mf = new Miniflare(
  convertV4MiniflareOptions({
    modules: true,
    script: bundle.outputFiles[0].text,
    compatibilityDate: '2026-10-18',
    outboundService: (request) =>
      new URL(request.url).href === `https://${domain}/cdn-cgi/access/certs`
        ? Response.json({ keys: [jwk] })
        : new Response('External requests forbidden', { status: 502 }),
    bindings: { ACCESS_TEAM_DOMAIN: domain, ACCESS_AUD: aud },
  }),
);
const sign = (a = aud, exp = '5m') =>
  new SignJWT({ type: 'app' })
    .setSubject('synthetic')
    .setIssuedAt()
    .setExpirationTime(exp)
    .setIssuer('https://' + domain)
    .setAudience(a)
    .setProtectedHeader({ alg: 'RS256' })
    .sign(privateKey);
let checks = 0;
try {
  for (const path of [
    '/',
    '/api/auth/config',
    '/api/user/saved-content',
    '/_next/static/synthetic.js',
  ]) {
    for (const token of ['', 'forged', await sign('b'.repeat(64)), await sign(aud, '-1m')]) {
      const r = await mf.dispatchFetch('https://staging.test' + path, {
        headers: {
          'Cf-Access-Jwt-Assertion': token,
          'Cf-Access-Authenticated-User-Email': 'forged@example.invalid',
        },
      });
      assert.equal(r.status, 403);
      checks++;
    }
    const r = await mf.dispatchFetch('https://staging.test' + path, {
      headers: { 'Cf-Access-Jwt-Assertion': await sign() },
    });
    assert.equal(r.status, 200);
    assert.equal(await r.text(), path);
    assert.equal(
      r.headers.get('cache-control'),
      path.startsWith('/_next/static/') ? 'private, max-age=300, immutable' : 'private, no-store',
    );
    checks++;
  }
  await mf.setOptions(
    convertV4MiniflareOptions({
      modules: true,
      script: bundle.outputFiles[0].text,
      compatibilityDate: '2026-10-18',
    }),
  );
  assert.equal((await mf.dispatchFetch('https://staging.test')).status, 403);
  checks++;
} finally {
  await mf.dispose();
}
await mkdir('reports/final-staging', { recursive: true });
await writeFile(
  'reports/final-staging/access-workerd.json',
  JSON.stringify(
    {
      runtime: 'actual local workerd',
      checks,
      failed: 0,
      provider: 'local signed JWKS fixture; hosted Access unverified',
      databaseUrlUsed: false,
    },
    null,
    2,
  ),
);
console.log('Access workerd checks:', checks);
