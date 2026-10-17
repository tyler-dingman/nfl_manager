import { loadEnvConfig } from '@next/env';
import { readFile, writeFile } from 'node:fs/promises';
loadEnvConfig(process.cwd());
const key = process.env.UNABATED_API_KEY!;
const results: unknown[] = [];
async function request(label: string, path: string, body?: unknown) {
  const response = await fetch('https://data.unabated.com' + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      'X-Api-Key': key,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  let value: any;
  try {
    value = JSON.parse(text);
  } catch {
    value = { unparsed: text };
  }
  const safe = JSON.parse(JSON.stringify(value).replaceAll(key, '[REDACTED]'));
  results.push({
    label,
    path,
    method: body ? 'POST' : 'GET',
    httpStatus: response.status,
    response: safe,
  });
  await writeFile(
    'reports/unabated-link-diagnostics.json',
    JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      label,
      httpStatus: response.status,
      success: value.success,
      status: value.status,
      dataStatus: value.data?.status,
      messages: value.messages,
    }),
  );
  return value;
}
async function main() {
  const boards = JSON.parse(await readFile('/tmp/unabated-diagnostic-boards.json', 'utf8'));
  const rows: any[] = [];
  for (const board of boards)
    for (const league of Object.values(board.body.data.odds ?? {}) as any[])
      for (const period of Object.values(league.periodTypes ?? {}) as any[])
        for (const group of Object.values(period.pregame ?? {}) as any[]) {
          if (group.statusId !== 1 || Date.parse(group.eventStart) <= Date.now()) continue;
          for (const side of Object.values(group.sides ?? {}) as any[])
            for (const line of Object.values(side.marketSourceLines ?? {}) as any[]) {
              // Source 2 is FanDuel, observed on the actual account's freshly returned example link.
              if (
                line.marketSourceId === 2 &&
                line.statusId === 1 &&
                !line.disabled &&
                line.marketLineId &&
                line.price != null
              )
                rows.push({
                  eventId: group.eventId,
                  eventName: group.eventName,
                  betTypeId: group.betTypeId,
                  periodTypeId: period.periodTypeId,
                  sideIndex: side.sideIndex,
                  ...line,
                });
            }
        }
  const first = rows.find((r) => r.marketLineId === 16930136022) ?? rows[0];
  if (first) {
    await request(
      'FanDuel single selection',
      `/deeplink?${new URLSearchParams({ ids: String(first.marketLineId), points: String(first.points ?? '_') })}`,
    );
    const second = rows.find((r) => r.eventId !== first.eventId);
    if (second)
      await request(
        'FanDuel different-game complete link',
        `/deeplink?${new URLSearchParams({ ids: [first.marketLineId, second.marketLineId].join(','), points: [first.points ?? '_', second.points ?? '_'].join(',') })}`,
      );
    results.push({
      label: 'Requested exact deep-link selections',
      selections: [first, second].filter(Boolean).map((r) => ({
        eventId: r.eventId,
        eventName: r.eventName,
        betTypeId: r.betTypeId,
        periodTypeId: r.periodTypeId,
        marketLineId: r.marketLineId,
        points: r.points,
        sideIndex: r.sideIndex,
      })),
    });
  }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL!).hostname))
    throw Error('Local DB required');
  const { authDb } = await import('../src/server/auth/database');
  const db = authDb();
  let pick: any;
  try {
    [pick] =
      await db`SELECT pm.provider_name AS player, e.away_team_id AS away,e.home_team_id AS home,e.kickoff_at AS kickoff,m.market_type AS market,m.side,m.line,p.odds
 FROM sportsbook_events e JOIN bet_markets m ON m.event_id=e.id JOIN sportsbook_prices p ON p.market_id=m.id
 JOIN provider_player_mappings pm ON pm.provider=e.provider AND pm.provider_player_id=m.entity_id
 WHERE e.provider='SPORTSGAMEODDS' AND e.kickoff_at>now() AND e.kickoff_at<now()+interval '7 days' AND NOT e.markets_locked
 AND (e.home_team_id='CHI' OR e.away_team_id='CHI') AND m.market_type='PASSING_YARDS' AND m.period='game' AND m.side='OVER'
 AND p.sportsbook='FANDUEL' AND p.available AND p.odds BETWEEN -150 AND 150
 ORDER BY p.updated_at DESC, m.line LIMIT 1`;
  } finally {
    await db.end();
  }
  if (pick) {
    const text = `Find this exact single FanDuel NFL player prop: ${pick.player}, ${pick.side} ${pick.line} ${pick.market.replaceAll('_', ' ').toLowerCase()}, full game, ${pick.away} at ${pick.home}, kickoff ${new Date(pick.kickoff).toISOString()}. Do not substitute another player, market, direction or threshold.`;
    results.push({ label: 'Legacy prop used as text only; no legacy identifiers submitted', pick });
    const submitted = await request('Generate exact legacy prop text', '/api/v1/bet/generate', {
      type: 'text',
      generateMobileLinks: false,
      content: { text },
    });
    if (
      submitted.status?.toLowerCase() === 'pending' &&
      /^[0-9a-f-]{36}$/i.test(submitted.requestId ?? '')
    ) {
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const status = await request(
          'Generated prop status',
          `/api/v1/bet/status/${submitted.requestId}`,
        );
        if (status.status?.toLowerCase() !== 'processing') break;
      }
    }
  }
  await writeFile(
    'reports/unabated-link-diagnostics.json',
    JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2) + '\n',
  );
}
main().catch(() => {
  console.error('Link diagnostics stopped; completed sanitized results retained.');
  process.exitCode = 1;
});
