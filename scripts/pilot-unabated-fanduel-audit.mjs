import nextEnv from '@next/env';
import { readFile, writeFile, open, unlink } from 'node:fs/promises';
nextEnv.loadEnvConfig(process.cwd());
const dir = 'reports/unabated-fanduel-audit';
const output = `${dir}/pilot-results.json`;
const key = process.env.UNABATED_API_KEY;
if (
  !key ||
  process.env.ODDS_PROVIDER !== 'sportsgameodds' ||
  process.env.ENABLE_FANDUEL_BETSLIP !== 'false'
)
  throw Error('Audit configuration required');
const { seed, pilot } = JSON.parse(await readFile(`${dir}/sample.json`, 'utf8'));
if (pilot.length !== 10 || new Set(pilot.map((p) => p.id)).size !== 10)
  throw Error('Exactly ten unique pilot selections required');
const lockPath = `${dir}/pilot.lock`;
const lock = await open(lockPath, 'wx');
let audit;
try {
  audit = JSON.parse(await readFile(output, 'utf8'));
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
  audit = { seed, startedAt: new Date().toISOString(), cap: 10, tests: [] };
}
if (audit.seed !== seed || audit.tests.some((t) => !pilot.some((p) => p.id === t.pick.id)))
  throw Error('Cannot replace an existing pilot');
const save = () => writeFile(output, JSON.stringify(audit, null, 2) + '\n');
async function request(test, path, body, timeout) {
  const record = { method: body ? 'POST' : 'GET', path, startedAt: new Date().toISOString() };
  test.requests.push(record);
  await save(); // Checkpoint submission intent before network: ambiguous failures are never resubmitted.
  const start = Date.now();
  try {
    const response = await fetch('https://data.unabated.com' + path, {
      method: record.method,
      headers: {
        'X-Api-Key': key,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: 'error',
      signal: AbortSignal.timeout(Math.max(1, timeout)),
    });
    record.httpStatus = response.status;
    const text = (await response.text()).replaceAll(key, '[REDACTED]');
    try {
      record.response = JSON.parse(text);
    } catch {
      record.response = { unparsed: text };
    }
  } catch (error) {
    record.error = error.name === 'TimeoutError' ? 'Request timeout' : 'Transport failure';
  }
  record.elapsedMs = Date.now() - start;
  await save();
  return record;
}
try {
  for (const pick of pilot) {
    if (audit.tests.length >= 10) break;
    // Existing entries are intentionally not replayed, even after an interrupted/ambiguous POST.
    if (audit.tests.some((t) => t.pick.id === pick.id)) continue;
    const text = `Find exactly this one FanDuel NFL player prop, with no substitutions. Game: ${pick.awayTeamId} at ${pick.homeTeamId}; kickoff ${pick.kickoffAt}. Player: ${pick.playerName}. Market: ${pick.marketType.replaceAll('_', ' ')}. Selection: ${pick.side} ${pick.line}. Period: full game. Preserve the exact player, game, market, direction and threshold. Return no matched selection if this exact offer is unavailable.`;
    const test = { pick, prompt: text, startedAt: new Date().toISOString(), requests: [] };
    audit.tests.push(test);
    await save();
    const start = Date.now();
    const submitted = await request(
      test,
      '/api/v1/bet/generate',
      { type: 'text', generateMobileLinks: false, content: { text } },
      20000,
    );
    const body = submitted.response;
    if (
      submitted.httpStatus !== 200 ||
      body?.status?.toLowerCase() !== 'pending' ||
      !/^[0-9a-f-]{36}$/i.test(body.requestId ?? '')
    ) {
      test.outcome = 'Submission error';
    } else {
      test.requestId = body.requestId;
      await save();
      const deadline = Date.now() + 60000;
      test.outcome = 'Timeout';
      for (let poll = 0; poll < 25 && Date.now() + 2000 < deadline; poll++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const result = await request(
          test,
          `/api/v1/bet/status/${test.requestId}`,
          undefined,
          Math.min(20000, deadline - Date.now()),
        );
        if (result.httpStatus !== 200) {
          test.outcome = result.error === 'Request timeout' ? 'Timeout' : 'Status error';
          break;
        }
        const status = result.response?.status?.toLowerCase();
        if (status === 'complete') {
          test.outcome = 'Complete';
          test.result = result.response;
          break;
        }
        if (status !== 'processing') {
          test.outcome = 'Status error';
          break;
        }
      }
    }
    test.elapsedMs = Date.now() - start;
    await save();
    console.log(
      JSON.stringify({
        number: audit.tests.length,
        player: pick.playerName,
        outcome: test.outcome,
        elapsedMs: test.elapsedMs,
        requests: test.requests.length,
      }),
    );
    if (test.requests.some((r) => [401, 403, 429].includes(r.httpStatus))) {
      audit.stoppedReason = 'Access or rate restriction; no further submissions';
      break;
    }
  }
  audit.finishedAt = new Date().toISOString();
  await save();
} finally {
  await lock.close();
  await unlink(lockPath);
}
