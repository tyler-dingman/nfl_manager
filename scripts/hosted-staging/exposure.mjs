import { readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
const root = process.cwd() + '/',
  account = '6e8c301360ab628706dcf3acf55f0dbb',
  name = 'down-distance-rc3-staging-web',
  mode = process.argv[2];
if (!['enable', 'disable'].includes(mode)) throw Error('Explicit enable/disable required');
const token = (
  await readFile(os.homedir() + '/Library/Preferences/.wrangler/config/default.toml', 'utf8')
).match(/^oauth_token\s*=\s*"([^"]+)"/m)[1];
if (mode === 'enable') {
  const deployments = JSON.parse(
      await readFile(root + 'reports/hosted-staging-rc3/private-deployments.json', 'utf8'),
    ),
    settings = JSON.parse(
      await readFile(
        root + 'reports/hosted-staging-rc3/completion/workers-private-settings.json',
        'utf8',
      ),
    );
  if (
    deployments.length !== 5 ||
    deployments.some((d) => d.exitCode !== 0) ||
    settings.length !== 5 ||
    settings.some(
      (s) => s.exposure.enabled || s.exposure.previews_enabled || s.schedules.schedules.length,
    )
  )
    throw Error('Private preconditions not satisfied');
  const web = settings.find((s) => s.role === 'web');
  for (const binding of ['STAGING_ACCESS_SECRET', 'AUTH_JWT_SECRET', 'ASSETS', 'D1_USERS'])
    if (!web.bindings.some((b) => b.name === binding))
      throw Error('Missing gating binding ' + binding);
}
const url = `https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${name}/subdomain`;
const response = await fetch(url, {
  method: 'POST',
  headers: {
    authorization: 'Bearer ' + token,
    'content-type': 'application/json',
    'Cloudflare-Workers-Script-Api-Date': '2025-08-01',
  },
  body: JSON.stringify({ enabled: mode === 'enable', previews_enabled: false }),
});
const x = await response.json();
if (!response.ok || !x.success) throw Error('Exposure change failed ' + JSON.stringify(x.errors));
const verify = await fetch(url, { headers: { authorization: 'Bearer ' + token } }),
  v = await verify.json();
if (!v.success || v.result.enabled !== (mode === 'enable') || v.result.previews_enabled !== false)
  throw Error('Exposure verification failed');
await writeFile(
  root + `reports/hosted-staging-rc3/completion/exposure-${mode}.json`,
  JSON.stringify({ checkedAtUtc: new Date().toISOString(), worker: name, ...v.result }, null, 2) +
    '\n',
);
const config = root + 'config/rc3-hosted.web.toml';
let text = await readFile(config, 'utf8');
text = text.replace(/^workers_dev = (?:true|false)$/m, 'workers_dev = ' + (mode === 'enable'));
await writeFile(config, text);
console.log(
  'Web workers.dev ' + mode + ' verified; preview URLs disabled. Internal Workers unchanged.',
);
