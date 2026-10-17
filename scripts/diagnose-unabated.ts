import { loadEnvConfig } from '@next/env';
import { writeFile } from 'node:fs/promises';
loadEnvConfig(process.cwd());
const key = process.env.UNABATED_API_KEY;
if (!key) throw new Error('UNABATED_API_KEY is missing');
const BASE = 'https://data.unabated.com';
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let lastOddsCompleted = Date.now(); // Also respect a just-completed manual/API Keys test.
const results: Array<Record<string, unknown>> = [];
const boards: unknown[] = [];
function safe(value: unknown): unknown {
  if (typeof value === 'string') return value.replaceAll(key!, '[REDACTED]');
  if (Array.isArray(value)) return value.map(safe);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        /api.?key|authorization|token|secret/i.test(k) ? '[REDACTED]' : safe(v),
      ]),
    );
  return value;
}
function counts(body: any) {
  const events = new Set();
  const markets = new Set();
  const sources = new Set();
  let availableSelections = 0;
  for (const league of Object.values(body?.data?.odds ?? {}) as any[])
    for (const period of Object.values(league.periodTypes ?? {}) as any[])
      for (const groups of [period.pregame, period.live])
        for (const group of Object.values(groups ?? {}) as any[]) {
          if (group.eventId != null) events.add(group.eventId);
          for (const side of Object.values(group.sides ?? {}) as any[])
            for (const main of Object.values(side.marketSourceLines ?? {}) as any[])
              for (const line of [main, ...(main.alternateLines ?? [])])
                if (line.statusId === 1 && !line.disabled) {
                  availableSelections++;
                  sources.add(line.marketSourceId);
                  markets.add(
                    [
                      group.eventId,
                      period.periodTypeId,
                      group.betTypeId,
                      side.personId ?? side.teamId,
                      side.sideIndex,
                      line.points ?? '_',
                    ].join('|'),
                  );
                }
        }
  return {
    events: events.size,
    availableMarkets: markets.size,
    availableSelections,
    sourceIds: [...sources],
  };
}
async function request(label: string, path: string) {
  const isOdds = /\/odds(?:\?|$)/.test(path);
  if (isOdds) await wait(Math.max(0, lastOddsCompleted + 5500 - Date.now()));
  const start = Date.now();
  const row: Record<string, unknown> = {
    label,
    path,
    method: 'GET',
    startedAt: new Date(start).toISOString(),
  };
  try {
    const r = await fetch(BASE + path, {
      method: 'GET',
      headers: { 'X-Api-Key': key!, Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
      cache: 'no-store',
    });
    const raw = await r.text();
    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      body = { unparsedBody: raw };
    }
    Object.assign(row, {
      httpStatus: r.status,
      success: body.success ?? null,
      messages: safe(body.messages ?? body.message ?? null),
      retryAfter: r.headers.get('Retry-After'),
      durationMs: Date.now() - start,
    });
    if (body.success === true) {
      if (isOdds) {
        row.counts = counts(body);
        boards.push({ label, body: safe(body) });
      } else row.data = safe(body.data);
    } else row.safeErrorResponse = safe(body);
    results.push(row);
    console.log(JSON.stringify(row));
    return body;
  } catch {
    row.error = 'Transport failure or 30-second timeout';
    results.push(row);
    console.log(JSON.stringify(row));
    return null;
  } finally {
    if (isOdds) lastOddsCompleted = Date.now();
    await writeFile(
      'reports/unabated-diagnostics.json',
      JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2) + '\n',
    );
  }
}
async function main() {
  const straight = await request('NFL straight odds', '/market/nfl/straight/odds');
  const props = await request('NFL props odds (unfiltered)', '/market/nfl/props/odds');
  await request('NFL props sources', '/market/nfl/props/sources');
  if (props?.success === true) {
    const types = await request('Bet types', '/bettype');
    for (const [label, pattern] of [
      ['passing', /passing yards/i],
      ['receiving', /receiving yards/i],
      ['rushing', /rushing yards/i],
    ] as const) {
      const found = (types?.data ?? []).filter((t: any) => t.active && pattern.test(t.name ?? ''));
      if (found.length === 1)
        await request(`Filtered ${label} props`, `/market/nfl/props/odds?betTypeId=${found[0].id}`);
      else
        results.push({
          label: `Filtered ${label} props`,
          skipped: 'No unambiguous discovered bet type; review discovery manually.',
        });
    }
  } else {
    for (const label of ['passing', 'receiving', 'rushing'])
      results.push({
        label: `Filtered ${label} props`,
        skipped: 'Unfiltered NFL props failed; conditional test not run.',
      });
    const leagues = await request('League discovery', '/league');
    const mlb = (leagues?.data ?? []).find((l: any) => l.name?.toLowerCase() === 'mlb');
    if (mlb) await request('Other sport props (MLB)', '/market/mlb/props/odds');
    else
      results.push({
        label: 'Other sport props',
        skipped: 'MLB not returned by league discovery.',
      });
  }
  if (straight?.success === true)
    await request('NFL straight sources', '/market/nfl/straight/sources');
  await writeFile('/tmp/unabated-diagnostic-boards.json', JSON.stringify(boards));
  await writeFile(
    'reports/unabated-diagnostics.json',
    JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2) + '\n',
  );
}
main().catch(() => {
  console.error('Diagnostic sequence failed; completed results retained.');
  process.exitCode = 1;
});
