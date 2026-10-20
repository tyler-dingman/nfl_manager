import next from 'next';
import { readFile } from 'node:fs/promises';
import { createRestBindings } from './d1-rest';
import { createNodeOrigin } from './origin-server';
import type { DatabaseOwner } from '../../../packages/storage/multi-d1';
// Built by scripts/render-staging/build.mjs; never a separately registered route table.
// @ts-ignore generated build output
import api from '../../../.staging/render-node/api.mjs';
async function main() {
  if (
    process.env.DD_NODE_STAGING !== 'true' ||
    process.env.NODE_ENV !== 'production' ||
    process.env.AUTH_PROVIDER !== 'firebase' ||
    process.env.FIREBASE_AUTH_ENABLED !== 'true' ||
    process.env.SEARCH_ANSWER_PROVIDER !== 'deterministic' ||
    process.env.APP_PUBLIC_CACHE_ENABLED !== 'false' ||
    process.env.APP_PASSWORD_ENABLED !== 'false' ||
    process.env.APP_MULTI_D1 !== 'true' ||
    process.env.APP_DATA_BACKEND !== 'd1' ||
    process.env.APP_OBJECT_BACKEND !== 'd1'
  )
    throw Error('Explicit isolated Firebase staging configuration required');
  for (const key of [
    'APP_MAIL_ENABLED',
    'CONTENT_AUTOMATION_GLOBAL_ENABLED',
    'APP_ODDS_FETCH_ENABLED',
    'APP_EDITORIAL_EMAIL_ENABLED',
    'APP_ODDS_ENABLED',
    'APP_ODDS_PROCESSING_ENABLED',
    'APP_MAINTENANCE_ENABLED',
  ])
    if (process.env[key] !== 'false') throw Error('External provider/schedule flag must be false');
  if (
    process.env.FIREBASE_PROJECT_ID !== 'down-and-distance-8526c' ||
    process.env.FIREBASE_AUTH_DOMAIN !== 'down-and-distance-8526c.firebaseapp.com' ||
    process.env.FIREBASE_APP_ID !== '1:953719724874:web:a5d1a0d02ad191166b7fb3'
  )
    throw Error('Only the existing Firebase staging project is permitted');
  for (const key of [
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'SPORTSGAMEODDS_API_KEY',
    'ODDS_API_KEY',
    'RESEND_API_KEY',
    'SENDGRID_API_KEY',
    'WEB_PUSH_VAPID_PRIVATE_KEY',
  ])
    if (process.env[key]) throw Error('External provider credentials must be absent');
  process.env.NEXT_TELEMETRY_DISABLED = '1';
  const publicOrigin = process.env.DD_NODE_PUBLIC_ORIGIN ?? '',
    url = new URL(publicOrigin);
  if (publicOrigin !== 'https://down-distance-rc3-staging-web.tdingman5.workers.dev')
    throw Error('Only the existing staging public origin is permitted');
  if (process.env.AUTH_BASE_URL !== publicOrigin)
    throw Error('Canonical staging auth URL required');
  if (!process.env.DD_NODE_ORIGIN_SECRET || process.env.DD_NODE_ORIGIN_SECRET.length < 64)
    throw Error('Private origin secret required');
  const manifest = JSON.parse(
    await readFile(process.cwd() + '/config/render-staging/databases.json', 'utf8'),
  ) as Record<DatabaseOwner, string>;
  const bindings = createRestBindings({
    accountId: '6e8c301360ab628706dcf3acf55f0dbb',
    databaseIds: manifest,
    token: process.env.D1_REST_TOKEN ?? '',
  });
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid port');
  process.env.DD_NODE_INTERNAL_URL = 'http://127.0.0.1:' + port;
  const app = next({
    dev: false,
    hostname: url.hostname,
    port: 443,
    dir: process.cwd() + '/.staging/render-node/app',
  });
  await app.prepare();
  const server = createNodeOrigin({
    configuration: {
      secret: process.env.DD_NODE_ORIGIN_SECRET,
      audience: process.env.DD_NODE_AUDIENCE ?? 'dd-render-staging',
      publicOrigin,
    },
    bindings,
    env: { ...process.env },
    api,
    next: app.getRequestHandler(),
  });
  server.listen(port, '0.0.0.0', () => console.log('Private Node staging origin listening'));
}
void main().catch(() => {
  console.error('Private Node staging startup failed');
  process.exitCode = 1;
});
