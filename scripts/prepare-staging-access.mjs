import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export function accessApplication(identityProviderId, emails) {
  assert.match(identityProviderId, /^[a-f0-9-]{36}$/);
  assert(
    Array.isArray(emails) && emails.length > 0 && emails.length <= 10,
    'Provide 1–10 explicitly approved tester identities',
  );
  for (const email of emails)
    assert.match(
      email,
      /^[a-zA-Z0-9.!#$%&'+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/,
      'Exact email identities only; no wildcards',
    );
  assert.equal(new Set(emails.map((e) => e.toLowerCase())).size, emails.length);
  return {
    name: 'Down & Distance isolated staging',
    type: 'self_hosted',
    domain: 'down-distance-staging-web.tdingman5.workers.dev',
    session_duration: '1h',
    allowed_idps: [identityProviderId],
    auto_redirect_to_identity: true,
    app_launcher_visible: false,
    policies: [
      {
        name: 'Named staging reviewers',
        decision: 'allow',
        include: emails.map((email) => ({ email: { email } })),
      },
    ],
  };
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const application = accessApplication(process.argv[2] ?? '', process.argv.slice(3));
  await mkdir('.staging', { recursive: true });
  await writeFile('.staging/access-application.json', JSON.stringify(application, null, 2) + '\n', {
    mode: 0o600,
  });
  console.log(
    'Prepared local Access application request; not submitted. Copy the returned audience and reviewed team domain into web/API vars only after approved setup.',
  );
}
