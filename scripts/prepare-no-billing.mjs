/** Offline templates only. This script cannot deploy or create resources. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const out = '.staging/no-billing';
await mkdir(out, { recursive: true });
for (const [role, input] of [
  ['api', 'wrangler.api-no-billing-local.toml'],
  ['web', 'wrangler.no-billing-local.toml'],
  ['password', 'workers/password/wrangler.toml'],
]) {
  let text = await readFile(input, 'utf8');
  text = text.replace(
    /down-distance-(api|web|password)-local/g,
    'down-distance-$1-no-billing-staging',
  );
  text = text.replace(
    /(main|directory|migrations_dir) = "([^"]+)"/g,
    (_, key, value) =>
      `${key} = "${path.resolve(role === 'password' ? 'workers/password' : '.', value)}"`,
  );
  text = text.replace(
    /database_name = "[^"]+"/,
    'database_name = "down-distance-no-billing-staging"',
  );
  // Invalid placeholder prevents accidental remote operations before review.
  text = text.replace(
    /database_id = "[^"]+"/,
    'database_id = "REVIEW_REQUIRED_STAGING_DATABASE_UUID"',
  );
  text = text.replace(
    '[vars]',
    '[vars]\nAPP_PASSWORD_ENABLED = "true"\nAPP_CONTENT_ENABLED = "false"\nAPP_BRIEFINGS_ENABLED = "false"\nAPP_ODDS_ENABLED = "false"\nAPP_MAIL_ENABLED = "false"\nAPP_MAINTENANCE_ENABLED = "false"\nAUTH_BASE_URL = "https://REVIEW_REQUIRED_PRIVATE_STAGING_HOST"',
  );
  if (/r2_buckets|\[ai\]|queues|hyperdrive|durable_objects|\[triggers\]|DATABASE_URL/i.test(text))
    throw Error('Prohibited no-billing binding');
  await writeFile(`${out}/${role}.toml`, text);
}
console.log(
  'Offline review templates prepared; no remote commands executed. Deployment remains blocked.',
);
