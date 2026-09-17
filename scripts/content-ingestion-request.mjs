import { pathToFileURL } from 'node:url';

export function configuration(env) {
  const secret = env.AUTOMATION_SECRET;
  if (!secret || /\s/.test(secret) || /^["']|["']$/.test(secret))
    throw new Error(
      'CONTENT_AUTOMATION_SECRET must be nonempty with no whitespace or surrounding quotes.',
    );
  let url;
  try {
    url = new URL(env.BASE_URL);
  } catch {
    throw new Error('CONTENT_AUTOMATION_BASE_URL must be an HTTPS origin.');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error(
      'CONTENT_AUTOMATION_BASE_URL must be an HTTPS origin without credentials, path, query, or fragment.',
    );
  if (url.hostname === 'downdistance.com') url.hostname = 'www.downdistance.com';
  if (!['standard', 'video'].includes(env.GROUP))
    throw new Error('GROUP must be standard or video.');
  return { url: new URL(`/api/automation/content/global?group=${env.GROUP}`, url), secret };
}

export async function run(env = process.env, fetcher = fetch) {
  const { url, secret } = configuration(env);
  async function request(method) {
    let response;
    try {
      response = await fetcher(url, {
        method,
        redirect: 'manual',
        signal: AbortSignal.timeout(240_000),
        headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' },
      });
    } catch {
      throw new Error(
        `${method} ingestion request failed or timed out. Check run history before retrying a POST; it may have executed.`,
      );
    }
    // Never log arbitrary response bodies, which can contain secrets or provider HTML.
    if (response.status >= 300 && response.status < 400)
      throw new Error(
        'Endpoint redirected. Set CONTENT_AUTOMATION_BASE_URL to the canonical deployment origin; credentials were not forwarded.',
      );
    let body;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (response.status === 401 || response.status === 403) {
      const source =
        body?.code === 'automation-unauthorized' || body?.error === 'Unauthorized'
          ? 'The API rejected the credential. Synchronize GitHub CONTENT_AUTOMATION_SECRET with the active deployment.'
          : 'Check deployment protection, preview access, and the intended deployment URL.';
      throw new Error(`HTTP ${response.status}. ${source}`);
    }
    if (body?.code === 'automation-not-configured')
      throw new Error(
        'The deployed API is missing a valid CONTENT_AUTOMATION_SECRET. Configure it and redeploy.',
      );
    if (!response.ok) throw new Error(`Ingestion endpoint returned HTTP ${response.status}.`);
    if (body?.ok !== true)
      throw new Error('Endpoint returned an invalid or unsuccessful JSON response.');
    return body;
  }
  const check = await request('GET');
  if (check.service !== 'content-automation' || check.authenticated !== true)
    throw new Error(
      'Authentication preflight contract missing. Deploy the updated API before running this workflow.',
    );
  if (env.CHECK_ONLY === 'true') return { authenticated: true };
  const result = await request('POST');
  if (
    typeof result.failedJobs !== 'undefined' &&
    (!Number.isInteger(result.failedJobs) || result.failedJobs !== 0)
  )
    throw new Error('Ingestion reported failed jobs. Inspect the content automation ledger.');
  return { authenticated: true, skipped: result.skipped === true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run()
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(`::error::${error.message}`);
      process.exitCode = 1;
    });
}
